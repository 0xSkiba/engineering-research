/**
 * Abuse gate: многоуровневые лимиты + риск-скор + прогрессивный ответ.
 * Схема: allow → throttle → challenge (Turnstile/PoW) → shadow (тихое ограничение) → deny.
 *
 * ВСЕ пороги и веса ниже — стартовые значения для примера (уверенность L).
 * Подбирайте их по своим логам и пересматривайте регулярно.
 */
import type Redis from "ioredis";
import { TokenBucketLimiter, type BucketSpec } from "./token-bucket";
import type { RequestSignals } from "./signals";

export type Decision = "allow" | "throttle" | "challenge" | "shadow" | "deny";

export interface Actor {
  accountId?: string;
  accountAgeHours?: number;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  paid?: boolean;
  reputation?: number; // 0..100, растёт с «хорошей» историей
  shadowBanned?: boolean;
}

/** Стоимость эндпоинтов в токенах: дорогие запросы «весят» больше. */
export const ENDPOINT_COST: Record<string, number> = {
  "GET /api/markets": 1,
  "GET /api/markets/:id/history": 5,  // тяжёлый запрос к БД
  "POST /api/export": 50,             // генерация CSV
  "POST /api/signup": 1,
  "POST /api/login": 1,
};

/** Квоты зависят от доверия к аккаунту: новые и неверифицированные получают меньше. */
function accountTier(a: Actor): { capacity: number; refillPerSec: number } {
  if (a.paid) return { capacity: 2000, refillPerSec: 20 };
  if (a.phoneVerified && (a.accountAgeHours ?? 0) > 24 * 7) return { capacity: 600, refillPerSec: 5 };
  if (a.emailVerified) return { capacity: 200, refillPerSec: 1 };
  return { capacity: 50, refillPerSec: 0.2 };
}

export function riskScore(sig: RequestSignals, a: Actor, velocity: { subnetSignups1h: number; fpAccounts24h: number }): number {
  let s = 0;
  if (sig.ipType === "datacenter") s += 25;
  if (sig.ipType === "tor") s += 30;
  if (sig.ipType === "vpn") s += 10;          // много честных VPN-пользователей → малый вес
  if (!sig.fingerprint) s += 10;
  if (!sig.userAgent || /curl|python|httpclient|go-http/i.test(sig.userAgent)) s += 20;
  if ((a.accountAgeHours ?? 0) < 1) s += 15;
  if (!a.emailVerified) s += 10;
  if (velocity.subnetSignups1h > 20) s += 25;
  if (velocity.fpAccounts24h > 3) s += 30;     // одно устройство — много аккаунтов
  s -= Math.min(30, (a.reputation ?? 0) / 3);
  if (a.paid) s -= 30;
  return Math.max(0, Math.min(100, s));
}

export function decide(score: number, limited: boolean): Decision {
  if (score >= 90) return "deny";
  if (score >= 70) return "shadow";
  if (score >= 45) return "challenge";
  if (limited) return "throttle";
  return "allow";
}

export class AbuseGate {
  private limiter: TokenBucketLimiter;
  constructor(private redis: Redis) {
    this.limiter = new TokenBucketLimiter(redis);
  }

  /** Сколько аккаунтов видели с этого fingerprint за 24ч (HyperLogLog — дёшево по памяти). */
  async noteFingerprintAccount(fp: string, accountId: string): Promise<number> {
    const k = `vel:fp-accts:${fp}:${new Date().toISOString().slice(0, 10)}`;
    await this.redis.pfadd(k, accountId);
    await this.redis.expire(k, 2 * 86400);
    return this.redis.pfcount(k);
  }

  async check(endpoint: string, sig: RequestSignals, actor: Actor): Promise<{ decision: Decision; retryAfterMs: number; reason: string }> {
    const cost = ENDPOINT_COST[endpoint] ?? 1;
    const tier = accountTier(actor);
    const ep = endpoint.replace(/\s+/g, "_");

    const buckets: BucketSpec[] = [
      // 1. Глобальный предохранитель для эндпоинта (защищает БД при распределённой атаке)
      { key: `rl:${ep}:global`, capacity: 5000, refillPerSec: 500 },
      // 2. Сеть: IP и подсеть (ASN — отдельно, если есть данные)
      { key: `rl:${ep}:ip:${sig.ip}`, capacity: 300, refillPerSec: 3 },
      { key: `rl:${ep}:net:${sig.subnet}`, capacity: 1500, refillPerSec: 15 },
      ...(sig.asn ? [{ key: `rl:${ep}:asn:${sig.asn}`, capacity: 20000, refillPerSec: 200 }] : []),
      // 3. Устройство: ловит «много аккаунтов с одного скрипта/браузера»
      ...(sig.fingerprint ? [{ key: `rl:${ep}:fp:${sig.fingerprint}`, capacity: 400, refillPerSec: 4 }] : []),
      // 4. Аккаунт — квота по уровню доверия
      ...(actor.accountId ? [{ key: `rl:${ep}:acct:${actor.accountId}`, ...tier }] : []),
    ];

    const lim = await this.limiter.takeAll(buckets, cost);

    const subnetSignups1h = Number((await this.redis.get(`vel:signup:net:${sig.subnet}:${hourBucket()}`)) ?? 0);
    const fpAccounts24h = sig.fingerprint
      ? await this.redis.pfcount(`vel:fp-accts:${sig.fingerprint}:${new Date().toISOString().slice(0, 10)}`)
      : 0;

    const score = riskScore(sig, actor, { subnetSignups1h, fpAccounts24h });
    let decision = decide(score, !lim.allowed);
    if (actor.shadowBanned) decision = "shadow";

    return { decision, retryAfterMs: lim.retryAfterMs, reason: `score=${score};blockedBy=${lim.blockedBy ?? "-"}` };
  }
}

export function hourBucket(d = new Date()): string {
  return d.toISOString().slice(0, 13); // "2026-10-21T14"
}

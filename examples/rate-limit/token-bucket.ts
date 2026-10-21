/**
 * Обёртка над token-bucket.lua. Один вызов Redis = атомарная проверка.
 * Важно: проверяем НЕСКОЛЬКО вёдер (аккаунт, IP, подсеть, fingerprint, глобальное),
 * запрос проходит, только если разрешили ВСЕ.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type Redis from "ioredis";

const LUA = readFileSync(join(__dirname, "token-bucket.lua"), "utf8");

export interface BucketSpec {
  key: string;          // "rl:<endpoint>:<dimension>:<value>"
  capacity: number;     // всплеск
  refillPerSec: number; // устойчивая скорость
}

export interface LimitResult {
  allowed: boolean;
  retryAfterMs: number;
  blockedBy?: string; // для логов, НЕ для ответа клиенту
}

export class TokenBucketLimiter {
  private sha?: string;
  constructor(private redis: Redis) {}

  private async load(): Promise<string> {
    if (!this.sha) this.sha = (await this.redis.script("LOAD", LUA)) as string;
    return this.sha;
  }

  async take(spec: BucketSpec, cost = 1): Promise<LimitResult> {
    const sha = await this.load();
    const [allowed, , retry] = (await this.redis.evalsha(
      sha, 1, spec.key,
      spec.capacity, spec.refillPerSec, cost, Date.now(),
    )) as [number, number, number];
    return { allowed: allowed === 1, retryAfterMs: retry, blockedBy: allowed ? undefined : spec.key };
  }

  /**
   * Проверить все вёдра. Упрощение: токены списываются из уже проверенных вёдер
   * даже если следующее отказало — это консервативно (атакующему хуже).
   * Если Redis недоступен — решайте политику явно: для дорогих/опасных
   * эндпоинтов fail-closed, для чтения можно fail-open с локальным лимитом.
   */
  async takeAll(specs: BucketSpec[], cost = 1): Promise<LimitResult> {
    for (const s of specs) {
      const r = await this.take(s, cost);
      if (!r.allowed) return r;
    }
    return { allowed: true, retryAfterMs: 0 };
  }
}

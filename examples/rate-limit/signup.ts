/**
 * Регистрация с защитой от массового создания аккаунтов.
 * Порядок: дешёвые проверки → лимиты → капча/PoW → создание → отложенные проверки.
 * Пороги — пример (уверенность L).
 */
import type Redis from "ioredis";
import { AbuseGate, hourBucket } from "./abuse-gate";
import { canonicalEmail, DisposableDomains, type RequestSignals } from "./signals";

const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY ?? "";

/** Серверная проверка Turnstile обязательна; токен одноразовый и живёт 300 с. */
export async function verifyTurnstile(token: string, ip: string, idempotencyKey: string): Promise<boolean> {
  if (!token || token.length > 2048) return false;
  const body = new URLSearchParams({ secret: TURNSTILE_SECRET, response: token, remoteip: ip, idempotency_key: idempotencyKey });
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return false; // fail-closed
  const data = (await res.json()) as { success: boolean; action?: string; hostname?: string };
  return data.success === true && data.action === "signup";
}

export interface SignupInput { email: string; password: string; turnstileToken: string; }
export type SignupResult =
  | { ok: true; userId: string; restricted: boolean }
  | { ok: false; status: 400 | 409 | 429; error: string; retryAfterSec?: number };

export async function signup(
  input: SignupInput,
  sig: RequestSignals,
  deps: {
    redis: Redis;
    gate: AbuseGate;
    disposable: DisposableDomains;
    users: {
      existsCanonical(canonical: string): Promise<boolean>;
      create(u: { email: string; canonicalEmail: string; password: string; signupIp: string; signupSubnet: string; signupFp?: string; restricted: boolean }): Promise<string>;
    };
    requestId: string;
  },
): Promise<SignupResult> {
  // 1. Дешёвая валидация
  let em: { canonical: string; domain: string };
  try { em = canonicalEmail(input.email); } catch { return { ok: false, status: 400, error: "invalid_email" }; }
  if (deps.disposable.has(em.domain)) return { ok: false, status: 400, error: "email_not_allowed" };

  // 2. Лимиты и риск (глобальный, IP, подсеть, fingerprint)
  const g = await deps.gate.check("POST /api/signup", sig, {});
  if (g.decision === "deny") return { ok: false, status: 429, error: "try_later", retryAfterSec: 3600 };
  if (g.decision === "throttle") return { ok: false, status: 429, error: "try_later", retryAfterSec: Math.ceil(g.retryAfterMs / 1000) };

  // 3. Velocity по подсети/домену почты (в т.ч. «медленные» волны: окно 1 час)
  const h = hourBucket();
  const netKey = `vel:signup:net:${sig.subnet}:${h}`;
  const domKey = `vel:signup:dom:${em.domain}:${h}`;
  const [netCount, domCount] = await Promise.all([deps.redis.incr(netKey), deps.redis.incr(domKey)]);
  await Promise.all([deps.redis.expire(netKey, 7200), deps.redis.expire(domKey, 7200)]);
  const unusualVelocity = netCount > 20 || (em.domain !== "gmail.com" && domCount > 50);

  // 4. Капча — всегда для регистрации (невидимая для большинства людей)
  if (!(await verifyTurnstile(input.turnstileToken, sig.ip, deps.requestId))) {
    return { ok: false, status: 400, error: "challenge_failed" };
  }

  // 5. Один канонический email — один аккаунт (уникальный индекс в БД — финальная гарантия)
  if (await deps.users.existsCanonical(em.canonical)) {
    // не раскрываем, что email занят (защита от перечисления) — в реальном UI: «проверьте почту»
    return { ok: false, status: 409, error: "check_your_email" };
  }

  // 6. Создаём; при подозрении — аккаунт в ограниченном режиме (нужен телефон/ручная проверка)
  const restricted = unusualVelocity || g.decision === "challenge" || g.decision === "shadow";
  const userId = await deps.users.create({
    email: input.email.trim(),
    canonicalEmail: em.canonical,
    password: input.password, // хешируйте Argon2id в слое users.create
    signupIp: sig.ip,
    signupSubnet: sig.subnet,
    signupFp: sig.fingerprint,
    restricted,
  });
  if (sig.fingerprint) await deps.gate.noteFingerprintAccount(sig.fingerprint, userId);

  // 7. Дальше: письмо с подтверждением; до подтверждения — минимальные квоты (см. accountTier)
  return { ok: true, userId, restricted };
}

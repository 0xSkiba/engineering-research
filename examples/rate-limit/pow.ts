/**
 * Простой proof-of-work (hashcash-подобный) для регистрации/дорогих действий.
 * Сервер выдаёт подписанный challenge, клиент ищет nonce: sha256(challenge + nonce)
 * начинается с `difficulty` нулевых бит. Сложность повышается с риск-скором.
 * Готовые решения: ALTCHA, Friendly Captcha, Turnstile (включает PoW-проверки).
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const SECRET = process.env.POW_SECRET ?? ""; // ≥32 байт из секрет-менеджера
if (!SECRET) console.warn("POW_SECRET не задан");

export function issueChallenge(difficultyBits: number, ttlSec = 120) {
  const salt = randomBytes(16).toString("hex");
  const expires = Math.floor(Date.now() / 1000) + ttlSec;
  const payload = `${salt}.${difficultyBits}.${expires}`;
  const sig = createHmac("sha256", SECRET).update(payload).digest("hex");
  return { challenge: `${payload}.${sig}`, difficultyBits };
}

function leadingZeroBits(buf: Buffer): number {
  let bits = 0;
  for (const b of buf) {
    if (b === 0) { bits += 8; continue; }
    return bits + Math.clz32(b) - 24;
  }
  return bits;
}

/** usedChallenges — Redis SET с TTL: защита от повторного использования решения. */
export async function verifySolution(
  challenge: string,
  nonce: string,
  markUsed: (challenge: string, ttlSec: number) => Promise<boolean>, // true если впервые
): Promise<boolean> {
  const parts = challenge.split(".");
  if (parts.length !== 4) return false;
  const [salt, diffStr, expStr, sig] = parts;
  const expected = createHmac("sha256", SECRET).update(`${salt}.${diffStr}.${expStr}`).digest();
  const given = Buffer.from(sig, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false;
  const exp = Number(expStr);
  if (Date.now() / 1000 > exp) return false;
  const hash = createHash("sha256").update(`${challenge}:${nonce}`).digest();
  if (leadingZeroBits(hash) < Number(diffStr)) return false;
  return markUsed(challenge, Math.max(1, exp - Math.floor(Date.now() / 1000)));
}

/** Клиентская часть (браузер/Node) — для иллюстрации. */
export function solve(challenge: string, difficultyBits: number): string {
  for (let n = 0; ; n++) {
    const h = createHash("sha256").update(`${challenge}:${n}`).digest();
    if (leadingZeroBits(h) >= difficultyBits) return String(n);
  }
}

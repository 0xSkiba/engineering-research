/**
 * Идентификаторы: UUIDv7 (RFC 9562) — сортируемы по времени (хорошо для B-tree),
 * не раскрывают количество записей, генерируются без координации.
 * Node 20+ без зависимостей. Для продакшна можно взять пакет `uuid` (v7).
 *
 * Правило для JS/JSON: 64-битные ID (Snowflake, bigint) отдавать в API строкой —
 * Number теряет точность после 2^53.
 */
import { randomBytes } from "node:crypto";

let lastMs = 0;
let seq = 0;

export function uuidv7(): string {
  let ms = Date.now();
  if (ms <= lastMs) { ms = lastMs; seq = (seq + 1) & 0xfff; if (seq === 0) ms = ++lastMs; }
  else { seq = randomBytes(2).readUInt16BE() & 0x7ff; } // случайный старт, оставляем запас для инкремента
  lastMs = ms;

  const b = randomBytes(16);
  // 48 бит времени
  b.writeUIntBE(ms, 0, 6);
  // версия 7 + 12 бит счётчика (монотонность внутри миллисекунды)
  b[6] = 0x70 | ((seq >> 8) & 0x0f);
  b[7] = seq & 0xff;
  // вариант RFC 9562 (10xx)
  b[8] = (b[8] & 0x3f) | 0x80;

  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Время создания из UUIDv7 (для отладки; не использовать как источник истины). */
export function uuidv7Time(id: string): Date {
  return new Date(parseInt(id.replace(/-/g, "").slice(0, 12), 16));
}

/** Безопасная сериализация bigint в JSON (строкой). */
export function jsonSafe<T>(v: T): string {
  return JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x));
}

/*
 * Публичные ID vs внутренние: если наружу нельзя светить время создания (UUIDv7 его содержит),
 * используйте отдельный случайный публичный ID (UUIDv4) или непрозрачный токен.
 * Последовательные целые ID наружу не отдавайте — они облегчают перебор (IDOR) и раскрывают объёмы.
 */

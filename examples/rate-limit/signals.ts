/**
 * Нормализация сигналов запроса: IP → подсеть, email → канонический вид, и т.п.
 * Без внешних зависимостей, чтобы было легко адаптировать.
 */
import { isIPv4, isIPv6 } from "node:net";

/** /24 для IPv4, /48 для IPv6 (выдаётся одному клиенту/сайту чаще, чем /64 — подберите под себя). */
export function subnetKey(ip: string): string {
  if (isIPv4(ip)) return ip.split(".").slice(0, 3).join(".") + ".0/24";
  if (isIPv6(ip)) {
    const full = expandIPv6(ip);
    return full.split(":").slice(0, 3).join(":") + "::/48";
  }
  return "unknown";
}

function expandIPv6(ip: string): string {
  const [head, tail = ""] = ip.split("::");
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const missing = 8 - h.length - t.length;
  return [...h, ...Array(Math.max(0, missing)).fill("0"), ...t]
    .map((p) => p.padStart(4, "0"))
    .join(":");
}

/**
 * Канонический email для проверки «один человек — много аккаунтов».
 * Храните исходный email для отправки писем, а канонический — для уникальности/velocity.
 * Правила точек/плюсов у Gmail; для других доменов убираем только "+tag" (консервативно).
 */
export function canonicalEmail(raw: string): { canonical: string; domain: string } {
  const email = raw.trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at < 1) throw new Error("invalid email");
  let local = email.slice(0, at);
  let domain = email.slice(at + 1);
  if (domain === "googlemail.com") domain = "gmail.com";
  local = local.split("+")[0];
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return { canonical: `${local}@${domain}`, domain };
}

/**
 * Список одноразовых доменов: загрузите файл из
 * https://github.com/disposable-email-domains/disposable-email-domains при старте
 * и обновляйте по расписанию.
 */
export class DisposableDomains {
  private set = new Set<string>();
  load(lines: string[]) {
    for (const l of lines) {
      const d = l.trim().toLowerCase();
      if (d && !d.startsWith("#")) this.set.add(d);
    }
  }
  has(domain: string): boolean {
    // проверяем и родительские домены: a.b.mailinator.com → mailinator.com
    const parts = domain.split(".");
    for (let i = 0; i < parts.length - 1; i++) {
      if (this.set.has(parts.slice(i).join("."))) return true;
    }
    return false;
  }
}

export interface RequestSignals {
  ip: string;
  subnet: string;
  asn?: number;
  ipType?: "residential" | "mobile" | "datacenter" | "vpn" | "tor" | "unknown"; // из MaxMind/ipinfo и т.п.
  fingerprint?: string;  // хеш визитора (FingerprintJS) или JA4 с edge
  userAgent?: string;
  country?: string;
}

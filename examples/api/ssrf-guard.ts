/**
 * SSRF-guard для исходящих запросов по URL от пользователя
 * (вебхуки, «свой RPC endpoint», превью ссылок, импорт по URL).
 * OWASP SSRF Prevention Cheat Sheet: allowlist лучше denylist.
 *
 * Ключевое: проверяем IP ПОСЛЕ DNS-резолва и подключаемся именно к проверенному IP
 * (иначе DNS rebinding: первый резолв публичный, второй — 127.0.0.1).
 * Редиректы не следуем автоматически — каждый новый URL проверяется заново.
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request } from "node:https";

const BLOCKED_V4: Array<[string, number]> = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16],  // link-local, включая метаданные облака 169.254.169.254
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["224.0.0.0", 4], ["240.0.0.0", 4],
];

function v4ToInt(ip: string): number {
  return ip.split(".").reduce((a, o) => (a << 8) + Number(o), 0) >>> 0;
}

export function isBlockedIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const n = v4ToInt(ip);
    return BLOCKED_V4.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (n & mask) === (v4ToInt(base) & mask);
    });
  }
  if (isIP(ip) === 6) {
    const x = ip.toLowerCase();
    if (x === "::" || x === "::1") return true;
    if (x.startsWith("fe8") || x.startsWith("fe9") || x.startsWith("fea") || x.startsWith("feb")) return true; // link-local
    if (x.startsWith("fc") || x.startsWith("fd")) return true; // unique local
    if (x.startsWith("ff")) return true; // multicast
    const mapped = x.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedIp(mapped[1]);
    if (x.startsWith("fd00:ec2::254")) return true; // AWS IMDS IPv6 (покрыт fd, оставлено для ясности)
    return false;
  }
  return true;
}

export interface SafeUrl { url: URL; ip: string; }

export async function validateOutboundUrl(raw: string, opts: { allowHosts?: string[] } = {}): Promise<SafeUrl> {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("invalid_url"); }
  if (url.protocol !== "https:") throw new Error("https_only");
  if (url.username || url.password) throw new Error("credentials_in_url");
  if (url.port && url.port !== "443") throw new Error("port_not_allowed");
  const host = url.hostname.toLowerCase();
  if (opts.allowHosts && !opts.allowHosts.some((h) => host === h || host.endsWith("." + h))) {
    throw new Error("host_not_allowed");
  }
  const addrs = await lookup(host, { all: true, verbatim: true });
  if (addrs.length === 0) throw new Error("dns_failed");
  // если ХОТЯ БЫ ОДИН адрес приватный — отказ (иначе атакующий смешивает записи)
  if (addrs.some((a) => isBlockedIp(a.address))) throw new Error("blocked_address");
  return { url, ip: addrs[0].address };
}

/** GET к проверенному IP с правильным SNI/Host; таймаут и лимит размера ответа. */
export async function safeGet(raw: string, maxBytes = 1_000_000, timeoutMs = 5000): Promise<{ status: number; body: Buffer; location?: string }> {
  const { url, ip } = await validateOutboundUrl(raw);
  return new Promise((resolve, reject) => {
    const req = request(
      {
        host: ip,                 // подключаемся к уже проверенному IP
        servername: url.hostname, // SNI + проверка сертификата по имени хоста
        headers: { host: url.hostname, "user-agent": "remainder-fetcher/1.0" },
        path: url.pathname + url.search,
        method: "GET",
        timeout: timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size > maxBytes) { req.destroy(new Error("response_too_large")); return; }
          chunks.push(c);
        });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks), location: res.headers.location }));
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
  // Редирект (3xx + location): вызывающий код решает, следовать ли, и снова вызывает safeGet (≤3 раз).
}

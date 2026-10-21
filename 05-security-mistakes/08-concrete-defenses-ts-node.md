# Конкретные защиты для стека TypeScript / Node / Next.js / Postgres / Docker

> Уверенность: **H** для OWASP, CVE и инцидентов; **M** для конфигов — рабочие шаблоны, проверять под свой проект.
> Это «шпаргалка с кодом» к [`01-owasp-web-and-api-top10.md`](01-owasp-web-and-api-top10.md), [`02-auth-sessions-idor.md`](02-auth-sessions-idor.md), [`03-secrets-ssrf-injection-cloud.md`](03-secrets-ssrf-injection-cloud.md).

## OWASP Top 10:2025 — одной строкой
A01 Broken Access Control (теперь включает SSRF) · A02 Security Misconfiguration · A03 Software Supply Chain Failures · A04 Cryptographic Failures · A05 Injection · A06 Insecure Design · A07 Authentication Failures · A08 Software or Data Integrity Failures · A09 Security Logging and Alerting Failures · A10 Mishandling of Exceptional Conditions. По данным OWASP, в среднем 3,73% протестированных приложений имели хотя бы одну из 40 CWE категории A01 ([owasp.org/Top10/2025](https://owasp.org/Top10/2025/0x00_2025-Introduction/)).

## Авторизация: IDOR и mass assignment
```ts
// Чужой объект → 404, не 403 (не подтверждаем существование)
const order = await db.order.findFirst({ where: { id: params.id, userId: session.userId } });
if (!order) return new Response('Not found', { status: 404 });

// Белый список полей на обновление; role/tenantId/balance из body не принимаются
const UpdateProfile = z.object({ name: z.string().min(1).max(80), avatarUrl: z.string().url().optional() }).strict();
const data = UpdateProfile.parse(await req.json());
```
Next.js: авторизация **в каждом** route handler / server action, не только в middleware — CVE-2025-29927 (CVSS 9.1): заголовок `x-middleware-subrequest` заставлял Next.js пропускать middleware целиком; исправлено в 15.2.3 / 14.2.25 / 13.5.9. На Nginx: `proxy_set_header x-middleware-subrequest "";`.

## Сессии, JWT, пароли
- Сессия в cookie `HttpOnly; Secure; SameSite=Lax`, не в `localStorage`.
- JWT: фиксированный алгоритм (отвергать `alg=none`), `exp` 5–15 мин + ротируемый refresh, проверка `aud/iss`.
- Пароли: **argon2id** (OWASP: память ≥ 19 МиБ, t = 2, p = 1) или bcrypt; никаких своих схем. 2FA для админов и для вывода средств.
- CORS: никакого `*` вместе с credentials; явный белый список origin.

## Секреты и окружение
```ts
// env через zod при старте — приложение не поднимется с пустым ключом
const Env = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
}).strict();
export const env = Env.parse(process.env);
```
- Всё с префиксом `NEXT_PUBLIC_` попадает в бандл: RPC-ключи с биллингом, сервисные ключи, приватные ключи — только на сервере.
- `.env` вне git; `gitleaks` в pre-commit и CI; GitHub push protection. Утёк — **ротировать**, а не чистить историю.

## Сеть и порты
- Docker публикует порты **в обход UFW** — пишите `127.0.0.1:5432:5432`, а не `5432:5432`. Проверка снаружи: `nmap -p- your.host`.
- Postgres, Redis, админки — только через Tailscale/WireGuard или Cloudflare Access.
- SSH только по ключам, `PermitRootLogin no`; контейнеры с `USER node`.

## SSRF (теперь внутри A01)
Для URL от пользователя (вебхуки, «свой RPC», превью ссылок): резолв DNS → блок приватных диапазонов (127/8, 10/8, 172.16/12, 192.168/16, 169.254.169.254, ::1, fc00::/7) → таймаут → лимит размера → повторная проверка на каждом редиректе. Готовый код: [`../examples/api/ssrf-guard.ts`](../examples/api/ssrf-guard.ts).

## Вебхуки
```ts
import { createHmac, timingSafeEqual } from 'node:crypto';
const expected = createHmac('sha256', env.WEBHOOK_SECRET).update(rawBody).digest('hex');
const ok = expected.length === sig.length && timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
if (!ok || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return new Response('bad signature', { status: 401 });
// идемпотентность по event.id: INSERT ... ON CONFLICT DO NOTHING → если 0 строк, уже обработано
```
Подписывать **сырое тело**, не распарсенный JSON.

## Supply chain (npm) — хроника сентября 2025
8 сентября 2025 фишингом захватили npm-аккаунт мейнтейнера и опубликовали вредоносные версии 18 пакетов, включая `chalk` и `debug`; код подменял адреса криптокошельков в браузере. Затем червь **Shai-Hulud** воровал npm/GitHub/облачные токены и заражал другие пакеты; CISA (23.09.2025) со ссылкой на StepSecurity — более 500 скомпрометированных пакетов ([CISA](https://www.cisa.gov/news-events/alerts/2025/09/23/widespread-supply-chain-compromise-impacting-npm-ecosystem)).

Для крипто-проекта это прямой вектор: цель атаки — подмена адресов. Меры:
```ini
# .npmrc
ignore-scripts=true
save-exact=true
```
- lockfile + `npm ci` / `pnpm install --frozen-lockfile`;
- «период созревания»: не ставить версии младше 7–14 дней (Renovate `minimumReleaseAge`);
- Dependabot только для security; Socket/`npm audit` в CI;
- CI-токены с минимальными правами, OIDC вместо статических ключей; GitHub Actions по SHA.

## Логи
```ts
import pino from 'pino';
export const log = pino({
  redact: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token', '*.seed', '*.privateKey'],
});
```
- Без паролей, токенов, seed-фраз, полных email/телефонов; `requestId` в каждой строке; экранировать переводы строк из пользовательского ввода (log injection).
- Одна «каноническая» строка на запрос (Stripe canonical log lines).

## Деньги и время
- Деньги: `numeric(38,0)` в минимальных единицах в Postgres, `bigint` в TS. Никакого `float`.
- Время: `timestamptz`, всё в UTC, конвертация только в UI.
- Балансы атомарно: `UPDATE accounts SET balance = balance - $1 WHERE id = $2 AND balance >= $1 RETURNING balance`.

## Что делать / чего не делать

**Делать**
- Тест «чужой ID → 404» на каждый эндпоинт с `:id`.
- `zod .strict()` на body, query, env, вебхуках и ответах внешних API.
- `nmap` своего сервера снаружи после каждого изменения docker-compose.

**Не делать**
- Не полагаться на middleware как на единственную авторизацию.
- Не ставить свежие npm-версии в день выхода.
- Не логировать `req.body` целиком «для отладки».

## Источники
- OWASP Top 10:2025: https://owasp.org/Top10/2025/0x00_2025-Introduction/
- Vercel — Postmortem on Next.js middleware bypass (CVE-2025-29927): https://vercel.com/blog/postmortem-on-next-js-middleware-bypass
- OWASP Password Storage Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- CISA — Widespread Supply Chain Compromise Impacting npm Ecosystem: https://www.cisa.gov/news-events/alerts/2025/09/23/widespread-supply-chain-compromise-impacting-npm-ecosystem
- Stripe — Canonical log lines: https://stripe.com/blog/canonical-log-lines
- Docker и UFW: https://docs.docker.com/engine/network/packet-filtering-firewalls/

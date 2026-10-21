# Примеры кода

Учебные примеры. Перед продакшном — тесты, ревью, для контрактов — аудит.

| Файл | Что показывает | Проверено |
|---|---|---|
| `rate-limit/token-bucket.lua` | Атомарный token bucket в Redis с весом запроса | Прогнан на fakeredis |
| `rate-limit/token-bucket.ts` | Обёртка, проверка нескольких вёдер | `tsc --strict` |
| `rate-limit/signals.ts` | Подсеть IPv4/IPv6, канонический email, одноразовые домены | `tsc` + ручной тест |
| `rate-limit/abuse-gate.ts` | Многомерные лимиты + риск-скор + прогрессивные решения | `tsc` |
| `rate-limit/signup.ts` | Регистрация: Turnstile Siteverify, velocity, ограниченный режим | `tsc` |
| `rate-limit/pow.ts` | Proof-of-work challenge с HMAC и защитой от повторов | `tsc` + ручной тест |
| `rate-limit/middleware.ts` | Express-middleware с allow/throttle/challenge/shadow/deny | `tsc` |
| `api/idor-safe-handler.ts` | Защита от IDOR/BOLA и mass assignment, tenant-контекст для RLS | `tsc` |
| `api/ssrf-guard.ts` | Проверка исходящих URL после DNS-резолва, подключение к проверенному IP | `tsc` + тест `isBlockedIp` |
| `db/tenant-rls.sql` | Postgres RLS для мультитенантности, append-only audit log | синтаксис проверен парсером PostgreSQL (pglast), на живой БД не запускался |
| `db/online-migration.sql` | Expand → migrate → contract, бэкфилл батчами, CONCURRENTLY, NOT VALID | синтаксис проверен pglast, на живой БД не запускался |
| `db/ids.ts` | UUIDv7 без зависимостей, bigint → строка в JSON | `tsc` + тест сортируемости/уникальности |
| `solidity/SafeVault.sol` | CEI, ReentrancyGuard, SafeERC20, роли, пауза, лимит вывода | компилируется solc 0.8.26 + OpenZeppelin 5 |

Зависимости для TS: `ioredis`, `express`, `zod`, `pg` (+ `@types/*`). Node 20+.

## Что делать / чего не делать
- **Делать:** адаптировать пороги под свои метрики; писать тесты на IDOR и лимиты; прогонять Slither/Foundry для Solidity.
- **Не делать:** копировать примеры в прод без ревью; использовать `SafeVault.sol` с реальными средствами без аудита; хранить секреты (`POW_SECRET`, `TURNSTILE_SECRET_KEY`) в коде.

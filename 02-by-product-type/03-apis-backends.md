# API и бэкенды (TypeScript/Node + Postgres)

> Уверенность: **H** (OWASP API Top 10 2023, Stripe, AWS, GitHub/Discord docs).

## Топ-риски API (OWASP API Security Top 10 — 2023)
API1 BOLA · API2 Broken Authentication · API3 Broken Object Property Level Authorization · API4 Unrestricted Resource Consumption · API5 Broken Function Level Authorization · API6 Unrestricted Access to Sensitive Business Flows · API7 SSRF · API8 Security Misconfiguration · API9 Improper Inventory Management · API10 Unsafe Consumption of APIs ([OWASP API Top 10 2023](https://owasp.org/API-Security/editions/2023/en/0x11-t10/)).

Самое частое у новичков и у кода от агентов — **API1 (BOLA/IDOR)** и **API3 (mass assignment)**: эндпоинт берёт `id` из URL и не проверяет владельца; или принимает весь `req.body` в `UPDATE` ([BOLA](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/); [OWASP Mass Assignment](https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html)). Пример безопасного обработчика: `examples/api/idor-safe-handler.ts`.

## Практики больших компаний
- **Идемпотентность** изменяющих запросов: заголовок `Idempotency-Key` + хранение результата ([Stripe API: idempotent requests](https://docs.stripe.com/api/idempotent_requests); [Stripe blog](https://stripe.com/blog/idempotency); реализация на Postgres: [brandur](https://brandur.org/idempotency-keys)).
- **Версионирование API** и совместимость: Stripe держит версии, закреплённые за аккаунтом, и слой преобразований ([APIs as infrastructure](https://stripe.com/blog/api-versioning); [Payments APIs: the first 10 years](https://stripe.com/blog/payment-api-design)).
- **Rate limiting на нескольких уровнях** — request rate, concurrency, load shedding по приоритету ([Stripe](https://stripe.com/blog/rate-limiters)); публичные лимиты GitHub (60/ч неаутентифицированно, 5000/ч для пользователя, плюс secondary limits по конкурентности и «очкам») ([GitHub REST limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)); Discord — per-route + global 50 req/s на бота + бан IP за 10 000 невалидных запросов за 10 минут ([Discord rate limits](https://discord.com/developers/docs/topics/rate-limits)). Подробно — в `06-abuse-and-bot-defense/`.
- **Стоимость запросов, а не их количество**: Shopify и GitHub лимитируют GraphQL по вычисленной сложности запроса ([Shopify](https://shopify.engineering/rate-limiting-graphql-apis-calculating-query-complexity); [GitHub GraphQL limits](https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api)).
- **Заголовки лимитов и 429**: [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html), [MDN 429](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429), черновик IETF RateLimit headers ([draft](https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/)).
- **Таймауты/ретраи/jitter/идемпотентность** при вызове внешних API ([AWS](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)).
- **Очереди**: не допускать неограниченных бэклогов ([AWS: queue backlogs](https://aws.amazon.com/builders-library/avoiding-insurmountable-queue-backlogs/)).
- **Справедливость между клиентами (multi-tenant fairness)** — квоты на арендатора ([AWS: Fairness in multi-tenant systems](https://aws.amazon.com/builders-library/fairness-in-multi-tenant-systems/)).
- **Платёжная устойчивость** (Shopify): таймауты, идемпотентность, circuit breakers ([10 tips](https://shopify.engineering/building-resilient-payment-systems)).

## Типовая структура запроса (Node/TS)
```
request → [edge: WAF/rate limit/bot score] → authn (сессия/API-key) → валидация входа (zod)
       → authz (политика: кто, что, над каким объектом, в каком tenant) → бизнес-логика
       → DAL (параметризованный SQL, tenant_id обязателен) → canonical log line → ответ
```
Валидация: [zod](https://zod.dev/). Безопасный SQL: query builder / параметры ([Kysely](https://kysely.dev/), [Drizzle sql``](https://orm.drizzle.team/docs/sql), [Prisma raw queries — осторожно с `$queryRawUnsafe`](https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/raw-queries)).

## Для дата-сайта типа Remainder
- Публичные данные отдавать из кэша/материализованных таблиц, не считать агрегаты на лету на каждый запрос.
- Для внешних источников (биржи, оракулы) — проверять свежесть и разумность данных; хранить `source`, `fetched_at`, `as_of`.
- Учитывать торговые часы эталонных рынков: Chainlink предупреждает, что фиды по акциям США обновляются только в торговые часы (09:30–16:00 ET, будни) и не обновляются в выходные ([Chainlink: Selecting Quality Data Feeds](https://docs.chain.link/data-feeds/selecting-data-feeds)). Для RWA perps это значит: «цена в выходные» — отдельная сущность, её нельзя путать с последней ценой закрытия.
- API-ключи для партнёров с квотами (см. `06-abuse-and-bot-defense/03-layered-design.md`).

## Что делать / чего не делать

**Делать**
- Проверять владельца/tenant на *каждом* обращении к объекту по id.
- Явный allowlist полей для create/update (zod-схема), никогда `...req.body`.
- Idempotency-Key на всех POST, которые создают деньги/ордера/письма.
- Лимиты: по ключу/пользователю + по IP/подсети + глобальные на дорогие эндпоинты; возвращать 429 с `Retry-After`.
- Таймауты на все исходящие вызовы; circuit breaker на нестабильные зависимости.

**Не делать**
- Не использовать последовательные числовые id как единственную «защиту» (см. Parler в `03-.../01-incident-catalog.md`).
- Не возвращать в ответе больше полей, чем нужно клиенту (API3).
- Не строить SQL конкатенацией строк, в т.ч. «только для сортировки».
- Не ходить по URL, присланному пользователем, без SSRF-фильтра (`examples/api/ssrf-guard.ts`).

# Engineering Research: как большие компании пишут и эксплуатируют софт — и чего не делать

База знаний для соло-разработчика, который строит продукты с помощью AI-агентов: веб-приложения и сайты (TypeScript/Node, Next.js), API и боты, Postgres/Redis на Hetzner, смарт-контракты (EVM/Solana), CRM и клиентские базы.

Собрано **21 октября 2026** из трёх независимых ресерчей (подробности — в конце). Источников: 371 URL в [`sources/sources.csv`](sources/sources.csv) + 17 первичных в [`sources/primary-registry.md`](sources/primary-registry.md) + список [`sources/synthesis-2026-10-21.md`](sources/synthesis-2026-10-21.md). Легенда уверенности и границы — [`00-methodology.md`](00-methodology.md).

## С чего начать
1. **Нужны правила для агента прямо сейчас** → [`07-checklists/AGENTS-rules.md`](07-checklists/AGENTS-rules.md) — скопировать в `CLAUDE.md` / `AGENTS.md`.
2. **Перед релизом** → [`07-checklists/SHIP-CHECKLIST-solo.md`](07-checklists/SHIP-CHECKLIST-solo.md) (15 минут) или полный [`07-checklists/CHECKLIST.md`](07-checklists/CHECKLIST.md) (🔴 до запуска, 🟡 до роста, ⚪ по необходимости).
3. **Боты обходят лимиты, ротируя аккаунты** → [`06-abuse-and-bot-defense/`](06-abuse-and-bot-defense/): [`01`](06-abuse-and-bot-defense/01-problem-and-layers.md) почему per-account не работает → [`03`](06-abuse-and-bot-defense/03-layered-design.md) многослойный дизайн с кодом → [`04`](06-abuse-and-bot-defense/04-signals-risk-score-products.md) чем связывать аккаунты, риск-скор, цены продуктов.
4. **БД выросла, думаете делить** → [`04-database-scaling-and-sharding/07-when-not-to-shard-numbers.md`](04-database-scaling-and-sharding/07-when-not-to-shard-numbers.md) (OpenAI: 800 млн пользователей на одном primary) → [`01`](04-database-scaling-and-sharding/01-scaling-ladder.md) лестница → [`02`](04-database-scaling-and-sharding/02-sharding-design.md) если всё-таки шардинг → [`06`](04-database-scaling-and-sharding/06-tenant-migration-runbook.md) runbook переноса.
5. **Нужен код** → [`examples/`](examples/README.md): rate limiting / антибот (TS + Lua), IDOR-safe handler, SSRF-guard, Postgres RLS, онлайн-миграции, UUIDv7, Solidity vault.
6. **Проектируете фичу** → раздел по типу продукта в [`02-by-product-type/`](02-by-product-type/); в конце каждого файла — «Что делать / чего не делать».

## 12 главных выводов
1. **Маленькие изменения + автоматические проверки + быстрый откат** — общий знаменатель Google, Meta, GitHub, AWS. Агент делает маленькие PR; CI ловит то, что вы не заметите.
2. **Самые дорогие аварии — от конфигурации и деплоя, а не от «сложного кода»**: Knight Capital ($460 млн за 45 минут из-за переиспользованного флага), CrowdStrike, Cloudflare ×2, AWS S3. Конфиг раскатывать постепенно, как код.
3. **Бэкап, который не восстанавливали, — не бэкап** (GitLab 2017: из пяти механизмов не сработал ни один).
4. **Шардинг нужен единицам.** OpenAI обслуживает 800 млн пользователей ChatGPT одним primary Postgres и ~50 репликами. Порядок: индексы → PgBouncer → реплики → кэш → вертикальный рост → партиционирование → разделение по доменам → и только потом шарды. Но `tenant_id` и UUIDv7 закладывать с первого дня.
5. **Миграция — это dual-write → backfill → сверка → переключение → план возврата**, а не копирование таблицы (Stripe, Notion, Figma).
6. **Аутентификация ≠ авторизация.** Broken Access Control — №1 в OWASP Top 10:2025 и API Top 10. Фильтр по `tenant_id`/`owner_id` в каждом запросе + RLS + тест «чужой → 404». Middleware Next.js — не единственная проверка (CVE-2025-29927).
7. **Лимит «на аккаунт» не останавливает ботов с тысячами аккаунтов.** Единица лимита — кластер аккаунтов, связанных общими сигналами (подсеть/ASN, device fingerprint, JA4, email-паттерн, кошелёк); глобальные и стоимостные лимиты на дорогие эндпоинты; квоты по доверию; Turnstile с серверной проверкой; тихие санкции (shadow ban, tarpit) вместо явных блоков.
8. **Секреты утекают постоянно; утёкший ключ ротируют**, а не удаляют из git. Секрет-сканер, OIDC в CI, никаких ключей в промптах агентов.
9. **Supply chain — главный новый вектор для JS-стека** (event-stream, Ledger Connect Kit, chalk/debug, Shai-Hulud, Nx): lockfile, `ignore-scripts`, «период созревания» версий, Actions по SHA, проверка каждого пакета, предложенного агентом.
10. **Крупнейшие крипто-потери — ключи, подписанты и фронтенд, а не баги контрактов** (Bybit $1,5 млрд, Ronin, WazirX, Radiant): аппаратные кошельки, мультисиг с независимыми устройствами, timelock, проверка calldata вне UI. Аудит — не гарантия (Euler, Nomad, KyberSwap были аудированы).
11. **Для ботов и RWA-данных: оракулы, часы торгов, идемпотентная отправка.** Спот-цена одного пула — не оракул (Mango, Inverse, Cream); подпись/nonce сохраняются до отправки; `finalized` для необратимого.
12. **Релиз, конфигурация и права доступа требуют той же дисциплины, что код**; после инцидента — blameless postmortem и одно новое правило в `CLAUDE.md` или один новый тест.

## Структура
| Раздел | Файлы | О чём |
|---|---|---|
| [`00-methodology.md`](00-methodology.md) | — | Легенды уверенности, что считать доказательством, границы |
| [`01-how-big-companies-work/`](01-how-big-companies-work/) | [00 цикл разработки для малой команды](01-how-big-companies-work/00-development-cycle-small-team.md) · [01 code review](01-how-big-companies-work/01-code-review-and-small-changes.md) · [02 тесты и CI](01-how-big-companies-work/02-testing-and-ci.md) · [03 флаги, канарейки, откат](01-how-big-companies-work/03-release-safety-flags-rollouts.md) · [04 SRE, SLO, постмортемы](01-how-big-companies-work/04-sre-slo-postmortems-observability.md) · [05 design docs, монорепо](01-how-big-companies-work/05-design-docs-monorepo-dependencies.md) · [06 проверяемые кейсы компаний](01-how-big-companies-work/06-company-cases-verified.md) · [07 процесс с AI-агентами](01-how-big-companies-work/07-ai-agent-workflow.md) | Google, Meta, GitHub, Stripe, Shopify, AWS, Cloudflare, Uber, Netflix, GitLab |
| [`02-by-product-type/`](02-by-product-type/) | [01 веб / Next.js](02-by-product-type/01-web-apps.md) · [02 мобильные / десктоп](02-by-product-type/02-mobile-desktop.md) · [03 API и бэкенды](02-by-product-type/03-apis-backends.md) · [04 смарт-контракты](02-by-product-type/04-smart-contracts.md) · [05 CRM и клиентские БД](02-by-product-type/05-crm-customer-databases.md) · [06 контракты: проверка до mainnet](02-by-product-type/06-smart-contracts-pre-mainnet-checks.md) · [07 CRM: модель данных и RLS с SQL](02-by-product-type/07-crm-data-model-sql.md) | PII, GDPR, аудит, soft delete, мультитенантность |
| [`03-anti-patterns-and-beginner-mistakes/`](03-anti-patterns-and-beginner-mistakes/) | [01 каталог 18 инцидентов](03-anti-patterns-and-beginner-mistakes/01-incident-catalog.md) · [02 ошибки новичков](03-anti-patterns-and-beginner-mistakes/02-beginner-mistakes.md) · [03 ловушки AI-агентов](03-anti-patterns-and-beginner-mistakes/03-ai-coding-agent-pitfalls.md) · [04 ошибка → последствие → фикс → проверка](03-anti-patterns-and-beginner-mistakes/04-mistakes-catalog-fix-verify.md) · [05 ошибки по слоям: бэкенд, Next.js, данные, ops, TS](03-anti-patterns-and-beginner-mistakes/05-backend-frontend-typescript-mistakes.md) | GitLab, Knight, AWS S3, Cloudflare, Meta, CrowdStrike, Capital One, Replit, Mars Climate Orbiter |
| [`04-database-scaling-and-sharding/`](04-database-scaling-and-sharding/) | [01 лестница масштабирования](04-database-scaling-and-sharding/01-scaling-ladder.md) · [02 дизайн шардов](04-database-scaling-and-sharding/02-sharding-design.md) · [03 ID](04-database-scaling-and-sharding/03-ids.md) · [04 онлайн-миграции](04-database-scaling-and-sharding/04-online-migrations.md) · [05 кейсы](04-database-scaling-and-sharding/05-case-studies.md) · [06 runbook переноса тенанта](04-database-scaling-and-sharding/06-tenant-migration-runbook.md) · [07 когда НЕ шардировать: цифры](04-database-scaling-and-sharding/07-when-not-to-shard-numbers.md) | Notion, Figma, Instagram, Discord, Shopify, GitHub, Slack, Stripe, Uber, OpenAI |
| [`05-security-mistakes/`](05-security-mistakes/) | [00 принципы: граница — backend](05-security-mistakes/00-principles-backend-boundary.md) · [01 OWASP Web/API Top 10](05-security-mistakes/01-owasp-web-and-api-top10.md) · [02 auth, сессии, IDOR, гонки](05-security-mistakes/02-auth-sessions-idor.md) · [03 секреты, SSRF, инъекции, облако](05-security-mistakes/03-secrets-ssrf-injection-cloud.md) · [04 supply chain](05-security-mistakes/04-supply-chain.md) · [05 крипто-специфика](05-security-mistakes/05-crypto-specific.md) · [06 постмортемы крипто-взломов](05-security-mistakes/06-crypto-hack-postmortems.md) · [07 офчейн-боты: ключи, RPC, nonce, reorgs](05-security-mistakes/07-crypto-bot-operations.md) · [08 конкретные защиты для TS/Node/Next/Docker](05-security-mistakes/08-concrete-defenses-ts-node.md) | |
| [`06-abuse-and-bot-defense/`](06-abuse-and-bot-defense/) | [01 проблема и слои](06-abuse-and-bot-defense/01-problem-and-layers.md) · [02 как делают Cloudflare/Stripe/Discord/GitHub/X/Meta](06-abuse-and-bot-defense/02-how-companies-do-it.md) · [03 многослойный дизайн + TypeScript](06-abuse-and-bot-defense/03-layered-design.md) · [04 сигналы, кластеры, риск-скор, цены продуктов](06-abuse-and-bot-defense/04-signals-risk-score-products.md) · [05 четыре проблемы и отказы лимитера](06-abuse-and-bot-defense/05-four-problems-and-limiter-failure-modes.md) | Ваш кейс: «боты под лимитом ротируют аккаунты» |
| [`07-checklists/`](07-checklists/) | [CHECKLIST](07-checklists/CHECKLIST.md) · [SHIP-CHECKLIST-solo](07-checklists/SHIP-CHECKLIST-solo.md) · [AGENTS-rules](07-checklists/AGENTS-rules.md) · [ROLLOUT-priorities](07-checklists/ROLLOUT-priorities.md) · [TEMPLATES](07-checklists/TEMPLATES.md) | Чеклисты, правила для агента, приоритеты P0/P1/P2, шаблоны PR/ADR/миграции/abuse review/postmortem |
| [`examples/`](examples/) | [README](examples/README.md) | Рабочий код: TS проверен `tsc --strict`, Lua — fakeredis, SQL — парсер Postgres, Solidity — solc 0.8.26 |
| [`sources/`](sources/) | [sources.csv](sources/sources.csv) · [primary-registry.md](sources/primary-registry.md) · [synthesis-2026-10-21.md](sources/synthesis-2026-10-21.md) | Все источники с датами проверки |

## Как собран репозиторий
Три независимых ресерча, проведённых 21.10.2026 разными агентами по одному ТЗ, слиты в одну структуру без потери содержания:
- **Ресерч A** (первоначальное содержимое этого репо): авторский синтез с тегами [Факт]/[Рекомендация], 17 первичных источников, шаблоны и runbook переноса тенанта. Файлы помечены пометкой о тегах под заголовком.
- **Ресерч B** (архив `eng-practices-research`): каркас разделов 01–07, 371 источник, `examples/`, `CHECKLIST.md`, `AGENTS-rules.md`.
- **Ресерч C** (синтез): файлы `07-ai-agent-workflow`, `07-crm-data-model-sql`, `05-backend-frontend-typescript-mistakes`, `07-when-not-to-shard-numbers`, `07-crypto-bot-operations`, `08-concrete-defenses-ts-node`, `04-signals-risk-score-products`, `SHIP-CHECKLIST-solo`.

Там, где ресерчи пересекаются, файлы ссылаются друг на друга, а не дублируют текст. Где они расходятся в цифрах — расхождение указано явно (см. [`00-methodology.md`](00-methodology.md)).

## Что делать / чего не делать
**Делать**
- Начать с `AGENTS-rules.md` и 🔴 пунктов `CHECKLIST.md`.
- Перечитывать каталоги инцидентов (03) и постмортемы (05/06) перед крупными изменениями.
- Обновлять репозиторий: источники стареют, лимиты, цены и API меняются.

**Не делать**
- Не копировать `examples/` в прод без ревью и тестов; не деплоить `SafeVault.sol` с реальными средствами без аудита.
- Не принимать пороги (лимиты, веса риск-скора) как истину — это стартовые значения (L).
- Не считать репозиторий юридической консультацией или аудитом безопасности.

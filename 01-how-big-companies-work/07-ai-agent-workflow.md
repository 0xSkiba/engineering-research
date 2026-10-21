# Как соло-билдер шипит с AI-агентами: процесс, который копирует дисциплину больших команд

> Уверенность: **M** — практика быстро меняется; основано на eng-practices Google, SRE book и документации Claude Code / AGENTS.md. Готовые правила для агента — [`../07-checklists/AGENTS-rules.md`](../07-checklists/AGENTS-rules.md); ловушки — [`../03-anti-patterns-and-beginner-mistakes/03-ai-coding-agent-pitfalls.md`](../03-anti-patterns-and-beginner-mistakes/03-ai-coding-agent-pitfalls.md).

## Принцип
У Google ревью, маленькие CL, тесты и постмортемы держатся на людях и инструментах. У соло-билдера «второй инженер» — это второй агент, CI и вы, читающий дифф. Процесс копируется, роли — нет.

## Цикл: исследуй → спланируй → закодь → проверь
1. **Исследуй.** Агент читает код и документацию **без правок**: какие модули затронуты, какие тесты есть, какие инварианты.
2. **Спланируй.** Агент пишет план (1–2 страницы: цель, не-цели, затронутые файлы, риски, план отката, тесты). Вы утверждаете. Это и есть design doc из [`05-design-docs-monorepo-dependencies.md`](05-design-docs-monorepo-dependencies.md) — только короче.
3. **Закодь.** Сначала падающий тест, потом код. Один PR — одна задача, < ~300–400 строк диффа.
4. **Проверь.** `tsc --noEmit`, lint, тесты, прогон миграции на копии; агент прикладывает вывод, а не «должно работать».
5. **Ревью.** Второй агент (новая сессия, не видевшая первого) читает дифф по чек-листу: авторизация, N+1, гонки, секреты, зависимости. Потом — вы, особенно `auth/`, `migrations/`, `contracts/`, CI, `.env*`.

## Файл правил (`CLAUDE.md` / `AGENTS.md`)
Короткий, императивный, с командами проверки. Минимум:
- стек и команды: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm db:migrate`;
- запреты: никаких `any`, все входы через zod `.strict()`, никаких секретов в коде и логах, миграции только через инструмент, никаких деструктивных команд без явного запроса;
- что считать готовым: тесты зелёные, дифф прочитан, в отчёте перечислены допущения и непроверенное.
Полный блок — в [`../07-checklists/AGENTS-rules.md`](../07-checklists/AGENTS-rules.md). Правила — не защита: их дублируют CI и branch protection, которые агент выключить не может.

## Тесты как контракт
- Для денег/лимитов/авторизации — тест пишется до кода и формулирует инвариант: «сумма балансов не меняется при переводе», «пользователь B получает 404 на объект A», «повтор с тем же Idempotency-Key не создаёт вторую запись».
- Агент не «чинит» красный тест ослаблением assert или `skip`. Если тест неверен — отдельный PR с объяснением.

## Окружение агента
- Dev-ключи с минимальными правами и лимитами; **никакого прод-доступа** (БД, кошельки, деплой). Кейс Replit/SaaStr 2025: агент удалил прод-БД во время code freeze.
- Синтетические/анонимизированные данные вместо клиентских PII.
- Недоверенный контент (issues, веб-страницы, ответы API, логи) — данные, не инструкции (prompt injection, «lethal trifecta»).

## Монорепо для агента
```
apps/web        Next.js (App Router)
apps/worker     BullMQ-воркеры, боты
packages/db     схема, миграции, DAL
packages/shared zod-схемы, типы, брендированные единицы
contracts/      Foundry / Anchor
docs/design/    mini design docs, ADR, postmortems
```
Весь контекст рядом — агент видит схему БД, типы и тесты в одной сессии; атомарные изменения проходят одним PR.

## Деплой
Пайплайн: typecheck → lint → test → build → миграции на staging → деплой → smoke-тест → откат одной командой (предыдущий Docker-тег). Агент готовит PR; деплой запускает CI после вашего merge, не агент.

## После инцидента
Короткий blameless postmortem (шаблон — [`04-sre-slo-postmortems-observability.md`](04-sre-slo-postmortems-observability.md)) и **одно новое правило в `CLAUDE.md` или один новый тест** — так ошибка агента не повторится.

## Что делать / чего не делать

**Делать**
- План до кода; тест до реализации; дифф до merge.
- Второй агент на ревью с чек-листом, не «посмотри, всё ли ок».
- Добавлять правило в `CLAUDE.md` после каждой ошибки агента.

**Не делать**
- Не давать агенту прод-ключи, seed-фразы, доступ к деплою.
- Не принимать мега-PR и PR без прогона проверок.
- Не позволять агенту менять тесты и код, который они проверяют, без вашего взгляда на тесты.

## Источники
- Google eng-practices — Small CLs: https://google.github.io/eng-practices/review/developer/small-cls.html
- Google eng-practices — The Standard of Code Review: https://google.github.io/eng-practices/review/reviewer/standard.html
- Claude Code — Memory (CLAUDE.md): https://code.claude.com/docs/en/memory
- AGENTS.md: https://agents.md/
- The Register — Replit AI agent deleted production database: https://www.theregister.com/software/2025/07/21/vibe-coding-service-replit-deleted-production-database/719783
- Simon Willison — The lethal trifecta: https://simonwillison.net/2025/jun/16/the-lethal-trifecta/

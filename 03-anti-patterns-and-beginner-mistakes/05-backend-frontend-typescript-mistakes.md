# Ошибки по слоям: бэкенд, Next.js, данные, ops, TypeScript — с реальными провалами

> Уверенность: **H** для инцидентов (официальные постмортемы, SEC, NASA); **M** для таблиц «как правильно» — общепринятая практика для стека TS/Node/Postgres.
> Дополняет [`02-beginner-mistakes.md`](02-beginner-mistakes.md) (там — ссылки на первоисточники по каждому пункту) и [`04-mistakes-catalog-fix-verify.md`](04-mistakes-catalog-fix-verify.md) (там — как проверить, что исправлено).

## Архитектура
- **Преждевременные микросервисы** для одного человека = распределённый монолит: сетевые вызовы вместо функций, распределённые транзакции, N деплоев. Правильно: модульный монолит (`apps/web`, `apps/worker`, `packages/db`, `packages/shared`) + отдельный воркер для очередей.
- **Over- vs under-engineering:** не строить Kafka/Kubernetes «на вырост», но миграции, бэкапы, очередь и идемпотентность — гигиена, а не over-engineering.

## Бэкенд
| Ошибка | Чем грозит | Как правильно |
|---|---|---|
| N+1 запросы | 1 запрос → 1001 | JOIN / `include`, `WHERE id = ANY($1)` |
| Нет пула соединений | Postgres падает от коннектов | `pg.Pool` + PgBouncer (transaction mode) |
| Нет миграций | Схема прода ≠ код | Drizzle/Prisma migrations в git + CI |
| Деньги во `float` | `0.1 + 0.2 ≠ 0.3` | `numeric(38,0)` в минимальных единицах + `bigint` |
| Нет дисциплины таймзон | Сдвиги, двойные начисления | `timestamptz`, UTC, конвертация только в UI |
| Нет идемпотентности | Двойные списания при ретрае | `Idempotency-Key` + уникальные ограничения |
| Нет ретраев / таймаутов | Каскадные сбои, повисшие воркеры | Backoff + jitter; `AbortSignal.timeout(5000)` |
| Долгие задачи в запросе | Таймауты, дубли | Очередь BullMQ, ответ `202` + статус |
| Проверка → обновление двумя запросами | Гонки, отрицательные балансы | `UPDATE … WHERE balance >= $1 RETURNING` |

Idempotency-Key на Postgres:
```ts
// CREATE TABLE idempotency_keys (key text PRIMARY KEY, user_id uuid, response jsonb);
const ins = await db.query(
  `INSERT INTO idempotency_keys(key, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING key`,
  [key, userId],
);
if (ins.rowCount === 0) return (await getSaved(key, userId)) ?? { status: 'in_progress' };
```

### Единицы измерения — Mars Climate Orbiter (NASA, 1999)
Аппарат потерян, потому что один модуль выдавал импульс в фунт-силах·секунду, а другой ожидал ньютон·секунды ([NASA MCO report](https://llis.nasa.gov/llis_lib/pdf/1009464main1_0641-mr.pdf)).
**Lesson:** в крипте это decimals (USDC — 6, ETH — 18, SOL — 9). Храните сумму вместе с токеном и decimals; брендированные типы `type Lamports = bigint & { __brand: 'lamports' }` не дают сложить лампорты с wei.

## Фронтенд / Next.js
- **Утечка секретов:** всё с `NEXT_PUBLIC_` попадает в бандл.
- **Авторизация только в middleware:** CVE-2025-29927 — см. [`../05-security-mistakes/08-concrete-defenses-ts-node.md`](../05-security-mistakes/08-concrete-defenses-ts-node.md).
- **Over-fetching:** отдавать клиенту DTO с нужными полями, не всю строку `users`.
- **Нет error boundaries:** `error.tsx` в сегментах App Router + Sentry; иначе одна ошибка кладёт страницу целиком.
- **Данные на каждый просмотр:** публичные страницы дата-сайта — ISR/кэш, не запрос в БД на каждый хит.

## Данные
- **Непроверенные бэкапы — GitLab, 31.01.2017.** Инженер, борясь с лагом репликации, удалил каталог данных на primary (db1) вместо реплики (db2). Из пяти механизмов бэкапа/репликации не сработал ни один: `pg_dump` молча падал из-за несовпадения версий 9.2 / 9.6, письма об ошибках отклонялись из-за DMARC, S3-бакет был пуст, снапшоты дисков не включены. Восстановились со staging-копии; пропали изменения с 17:20 до 00:00 UTC — ~5 000 проектов, ~5 000 комментариев, ~700 аккаунтов ([postmortem](https://about.gitlab.com/blog/postmortem-of-database-outage-of-january-31/)).
  **Lesson:** бэкап без проверенного восстановления — не бэкап. Автоматизируйте тестовое восстановление и алерт на *отсутствие* бэкапа.
- **Нет индексов / `SELECT *`:** `pg_stat_statements`, `EXPLAIN (ANALYZE, BUFFERS)`, индексы на внешние ключи и фильтры.
- **Soft-delete ловушки:** ломает уникальность (нужен `UNIQUE (email) WHERE deleted_at IS NULL`), забытые фильтры возвращают «удалённое», для GDPR это не удаление.

## Ops
- **Секреты в git** → боты сканируют GitHub за минуты. `.env` вне репо, Doppler/Infisical/SOPS, `gitleaks` в pre-commit.
- **Root** → `USER node` в Dockerfile, SSH по ключам, без root-логина.
- **Единые точки отказа — Cloudflare, 18.11.2025.** Изменение прав в ClickHouse заставило запрос вернуть дубли строк, «feature file» Bot Management вырос вдвое и превысил жёсткий лимит прокси (лимит стоял на 200 признаках при «~60 в использовании»). Ядро сети отдавало 5xx примерно с 11:20 до 14:30 UTC, полная нормализация — 17:06; Cloudflare назвала это худшим сбоем с 2019 года ([postmortem](https://blog.cloudflare.com/18-november-2025-outage/)). **Boeing 737 MAX:** MCAS опиралась на один датчик угла атаки.
  **Lesson:** валидируйте сгенерированные конфиги как пользовательский ввод; при ошибке откатывайтесь на известную-хорошую версию, а не падайте; критичное не должно зависеть от одного датчика/файла/сервера.
- **Переиспользованный флаг — Knight Capital, 01.08.2012.** По 8-K компании — около $440 млн до налогов примерно за 45 минут; приказ SEC (Release 34-70694) фиксирует «4 млн исполнений по 154 акциям, более 397 млн акций примерно за 45 минут» и убыток «более $460 млн». Причина: флаг, переиспользованный под новый смысл, активировал на одном из восьми серверов мёртвый код Power Peg, не удалённый с 2003 года; деплой делал один техник без второго ревьюера ([SEC](https://www.sec.gov/files/litigation/admin/2013/34-70694.pdf)).
  **Lesson:** удаляйте мёртвый код и старые флаги; не переиспользуйте флаг под новый смысл; деплой автоматический и одинаковый на всех серверах; kill switch.
- **Нет runbook-ов и деплой в пятницу:** запишите «как откатить», «как восстановить БД», «как ротировать ключ»; деплойте только если откат — одна команда и вы онлайн ближайшие 2 часа.

## TypeScript
- `"strict": true`, `"noUncheckedIndexedAccess": true`, запрет `any` через ESLint (`@typescript-eslint/no-explicit-any: error`).
- Типы исчезают в рантайме: body, query, вебхуки, ответы RPC и env — через zod (`Env.parse(process.env)` при старте; входы — `.strict()`).
- `Number` безопасен до 2^53 − 1: 64-битные ID и суммы в wei/lamports — `bigint`, в JSON — строкой.
- Не `as any`, не `@ts-ignore` для «быстро починить» — это место, где агент прячет ошибку.

## Что делать / чего не делать

**Делать**
- Идемпотентность, таймауты, очередь, `timestamptz`, `bigint` для денег — с первого дня, это дёшево.
- Еженедельное автоматическое тестовое восстановление бэкапа.

**Не делать**
- Не переиспользовать флаги/поля под новую семантику.
- Не деплоить без проверенного отката и без присутствия.
- Не хранить деньги и decimals раздельно от токена.

## Источники
- GitLab — Postmortem of database outage of January 31: https://about.gitlab.com/blog/postmortem-of-database-outage-of-january-31/
- Cloudflare — 18 November 2025 outage: https://blog.cloudflare.com/18-november-2025-outage/
- SEC — In the Matter of Knight Capital Americas LLC (Release 34-70694): https://www.sec.gov/files/litigation/admin/2013/34-70694.pdf
- NASA — Mars Climate Orbiter Mishap Investigation Board report: https://llis.nasa.gov/llis_lib/pdf/1009464main1_0641-mr.pdf
- Vercel — CVE-2025-29927 postmortem: https://vercel.com/blog/postmortem-on-next-js-middleware-bypass

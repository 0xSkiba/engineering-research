# Онлайн-миграции: dual writes, backfill, shadow/dark reads, переключение

> Уверенность: **H** (Stripe, Notion, Figma, GitHub, Shopify, GitLab, Postgres docs).

## Канонический 4-шаговый паттерн (Stripe)
1. **Dual writing** — писать и в старое, и в новое хранилище.
2. **Changing all read paths** — переключить чтения на новое.
3. **Changing all write paths** — писать только в новое.
4. **Removing old data** — удалить старое.

Stripe так мигрировал «hundreds of millions» объектов Subscriptions без остановки сервиса; сравнение старого и нового пути — через GitHub Scientist ([Online migrations at scale](https://stripe.com/blog/online-migrations); [Scientist](https://github.com/github/scientist)).

## Notion: шардирование монолита
- Double-write через **audit log + catch-up script** (а не прямую двойную запись в коде); backfill со всеми 96 CPU m5.24xlarge; при записи старых данных — пропуск более свежих записей; **dark reads**: читать из обоих, сравнивать, логировать расхождения ([Notion](https://www.notion.com/blog/sharding-postgres-at-notion)).
- Совет: логику миграции и логику проверки должны писать **разные люди** — чтобы не повторить одну ошибку дважды (там же). Для вас: проверку пишет другой агент/сессия по спецификации, не видя кода миграции.
- Подготовлен **reverse audit log** для отката на монолит (там же).
- Плановое окно было ~5 минут; узкое место — скорость catch-up (там же).
- Re-shard 32→96: логическая репликация Postgres, dark reads с паузой 1 с для догоняния реплик, сравнение и метрики, постепенный перевод через PgBouncer ([The Great Re-shard](https://www.notion.com/blog/the-great-re-shard)).

## Figma, GitHub, Shopify, Stripe DocDB
- Figma: логическое шардирование (views) с процентной выкаткой и откатом конфигом → затем физическое; «shadow application readiness» — прогон логического планировщика на продакшен-трафике для оценки ключей ([Figma](https://www.figma.com/blog/how-figmas-databases-team-lived-to-tell-the-scale/)).
- GitHub: Vitess VReplication или собственный write-cutover для переноса таблиц ([GitHub](https://github.blog/engineering/infrastructure/partitioning-githubs-relational-databases-scale/)); онлайн-изменение схемы MySQL — [gh-ost](https://github.com/github/gh-ost); апгрейд до MySQL 8.0 постепенно с возможностью отката ([GitHub MySQL 8.0](https://github.blog/engineering/infrastructure/upgrading-github-com-to-mysql-8-0/)).
- Shopify: Ghostferry — batch copy + хвост binlog ([Shopify](https://shopify.engineering/mysql-database-shard-balancing-terabyte-scale)).
- Stripe DocDB: ключевая фаза переключения короче, чем плановый failover primary — «a few seconds» ([Stripe DocDB](https://stripe.com/blog/how-stripes-document-databases-supported-99.999-uptime-with-zero-downtime-data-migrations)).

## Изменение схемы в Postgres без простоя (expand → migrate → contract)
| Задача | Безопасно | Опасно |
|---|---|---|
| Индекс | `CREATE INDEX CONCURRENTLY` ([docs](https://www.postgresql.org/docs/current/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY)) | `CREATE INDEX` на большой таблице |
| Новая колонка NOT NULL | добавить nullable → backfill батчами → `CHECK ... NOT VALID` → `VALIDATE` → `SET NOT NULL` | `ADD COLUMN ... NOT NULL` с volatile default |
| Переименование | новая колонка + dual write + переключение чтения + удаление | `RENAME` при работающем старом коде |
| Удаление колонки | сначала код перестаёт её читать, деплой, потом `DROP` | `DROP` в одном деплое с кодом |
| Любая миграция | `SET lock_timeout`, `statement_timeout` | бесконечное ожидание блокировки |

Руководства: [GitLab migration style guide](https://docs.gitlab.com/development/migration_style_guide/), линтеры [Squawk](https://squawkhq.com/), [strong_migrations](https://github.com/ankane/strong_migrations), инструмент [pg-osc](https://github.com/shayonj/pg-osc), логическая репликация ([docs](https://www.postgresql.org/docs/current/logical-replication.html)). Пример — `examples/db/online-migration.sql`.

## Что делать / чего не делать

**Делать**
- Expand → migrate → contract; каждая фаза — отдельный деплой.
- Backfill батчами с паузами, идемпотентно (можно перезапустить).
- Dark/shadow reads со сравнением и метриками расхождений перед переключением.
- План отката (reverse sync) до переключения.
- Проверку корректности миграции писать независимо от кода миграции.

**Не делать**
- Не менять уже применённые в проде миграции — только новые.
- Не делать «big bang» переключение без периода dual write и сравнения.
- Не запускать миграцию без `lock_timeout`.

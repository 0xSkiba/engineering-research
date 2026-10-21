# Типичные ошибки новичков (и как их не допускать)

> Уверенность: **H** там, где есть ссылка; **M** — обобщения автора на основе инцидентов из `01-incident-catalog.md`.

## Архитектура и процесс
| Ошибка | Почему плохо | Как правильно |
|---|---|---|
| Микросервисы с первого дня | Распределённые транзакции, сеть, деплой ×N; Shopify сознательно выбрал модульный монолит ([Shopify](https://shopify.engineering/deconstructing-monolith-designing-software-maximizes-developer-productivity); [Fowler](https://martinfowler.com/articles/microservice-trade-offs.html)) | Модульный монолит, границы модулей, позже — выделение |
| Шардирование «на вырост» | Notion называет преждевременное шардирование источником нагрузки на поддержку и ограничений в коде ([Notion](https://www.notion.com/blog/sharding-postgres-at-notion)) | Сначала лестница масштабирования (`04-database-scaling-and-sharding/01-scaling-ladder.md`) |
| Долгоживущие ветки | Конфликты, «big bang» релизы | Trunk-based + флаги ([SWE book ch.16](https://abseil.io/resources/swe-book/html/ch16.html)) |
| Нет postmortem'ов | Ошибки повторяются | Короткий blameless postmortem ([SRE](https://sre.google/sre-book/postmortem-culture/)) |
| Цель «100% аптайм» | Бесконечные затраты, страх деплоя | SLO + error budget ([SRE](https://sre.google/sre-book/embracing-risk/)) |

## База данных (Postgres)
| Ошибка | Как правильно |
|---|---|
| Нет индексов под реальные запросы; не смотрят `EXPLAIN` | `pg_stat_statements` + `EXPLAIN (ANALYZE, BUFFERS)` ([EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html); [pg_stat_statements](https://www.postgresql.org/docs/current/pgstatstatements.html); [Use The Index, Luke](https://use-the-index-luke.com/)) |
| `CREATE INDEX` на большой таблице блокирует запись | `CREATE INDEX CONCURRENTLY` ([docs](https://www.postgresql.org/docs/current/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY)); линтер миграций ([Squawk](https://squawkhq.com/), [strong_migrations](https://github.com/ankane/strong_migrations)) |
| Сотни соединений из serverless без пулера | PgBouncer/пулер провайдера ([PgBouncer](https://www.pgbouncer.org/features.html); [brandur: Postgres connections](https://brandur.org/postgres-connections); [Neon pooling](https://neon.com/docs/connect/connection-pooling); [Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres)) |
| `timestamp without time zone`, `money`, `serial`, `NOT IN`, `BETWEEN` с временем | Postgres wiki «Don't Do This» прямо не советует ([wiki](https://wiki.postgresql.org/wiki/Don%27t_Do_This)) |
| `float` для денег/цен | `numeric` в БД, decimal-библиотека в TS (bigint для минимальных единиц) — **M** |
| Игнорируют autovacuum и TXID wraparound | Notion и Figma называют проблемы vacuum одной из причин масштабирования ([Notion](https://www.notion.com/blog/sharding-postgres-at-notion); [Figma](https://www.figma.com/blog/how-figmas-databases-team-lived-to-tell-the-scale/); [Routine Vacuuming](https://www.postgresql.org/docs/current/routine-vacuuming.html)) |
| Бэкапы не проверяются | Тест восстановления по расписанию ([GitLab](https://about.gitlab.com/blog/2017/02/10/postmortem-of-database-outage-of-january-31/)) |
| БД доступна из интернета | Только приватная сеть/allowlist ([DeepSeek/Wiz](https://www.wiz.io/blog/wiz-research-uncovers-exposed-deepseek-database-leak)) |

## Безопасность (подробно — в `05-security-mistakes/`)
- Проверка прав только во фронтенде/middleware → IDOR/BOLA ([OWASP API1](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)).
- Секреты в git, в `NEXT_PUBLIC_*`, в логах ([OWASP Secrets](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)).
- Самописная криптография/хеширование паролей (вместо Argon2id/bcrypt) ([OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)).
- JWT без проверки алгоритма/срока/аудитории; JWT в localStorage ([RFC 8725](https://datatracker.ietf.org/doc/html/rfc8725); [Auth0: JWT library vulns](https://auth0.com/blog/critical-vulnerabilities-in-json-web-token-libraries/)).
- Rate limit только «на аккаунт» (см. `06-abuse-and-bot-defense/`).
- Пароли с правилами «спецсимвол+цифра+смена каждые 90 дней». NIST SP 800-63B: verifiers «SHALL NOT impose other composition rules» и не должны требовать периодической смены; вместо этого — проверка по blocklist скомпрометированных паролей ([NIST 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html)). Лучше — passkeys ([passkeys.dev](https://passkeys.dev/)).

## Надёжность
- Нет таймаутов на внешние вызовы; бесконечные ретраи без jitter ([AWS](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)).
- Неидемпотентные платежи/ордера при ретрае ([Stripe](https://stripe.com/blog/idempotency)).
- Распределённые блокировки на Redis «для корректности» — Kleppmann объясняет, почему это опасно без fencing tokens ([How to do distributed locking](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html)).
- Кэш без стратегии инвалидации и защиты от «thundering herd» ([AWS: caching challenges](https://aws.amazon.com/builders-library/caching-challenges-and-strategies/)).
- Логи без request_id и без структуры ([Stripe canonical log lines](https://stripe.com/blog/canonical-log-lines)).

## Что делать / чего не делать

**Делать**
- Начинать просто (монолит + Postgres + очередь), измерять, масштабировать по данным.
- Ставить линтер миграций и `statement_timeout`/`lock_timeout` для миграций.
- Хранить деньги/цены в `numeric`/целых минимальных единицах.
- Иметь таймауты, идемпотентность и структурированные логи с первого дня.

**Не делать**
- Не копировать архитектуру гигантов без их проблем.
- Не держать БД, Redis, ClickHouse, админки открытыми в интернет.
- Не изобретать криптографию, хеширование паролей, JWT-библиотеки.

# Проектирование шардирования: ключ, схемы, решардинг, cross-shard запросы

> Уверенность: **H** для фактов из кейсов; **M** для обобщений.

## 1. Выбор ключа шардирования
Требования (Figma): большинство запросов должно содержать ключ; внешние ключи работают только если FK = ключ шардирования; ключ должен равномерно распределять данные без hot spots ([Figma](https://www.figma.com/blog/how-figmas-databases-team-lived-to-tell-the-scale/)).

| Компания | Ключ | Комментарий |
|---|---|---|
| Notion | workspace ID | Блоки и связанные таблицы — по workspace, чтобы транзакции оставались в одном шарде ([Notion](https://www.notion.com/blog/sharding-postgres-at-notion)) |
| Shopify | `shop_id` | Добавлен во все таблицы магазина; магазины перемещаются между шардами ([Shopify shard balancing](https://shopify.engineering/mysql-database-shard-balancing-terabyte-scale)) |
| Slack (до Vitess) | workspace id | Упёрлись в предел: крупнейший клиент не помещался в крупнейший шард; Enterprise Grid и Slack Connect ломали допущение «команда в одном шарде» ([Slack](https://slack.engineering/scaling-datastores-at-slack-with-vitess/)) |
| Figma | несколько: UserID, FileID, OrgID | «Colos» — группы таблиц с общим ключом; joins и транзакции внутри colo ([Figma](https://www.figma.com/blog/how-figmas-databases-team-lived-to-tell-the-scale/)) |
| Discord (сообщения) | (channel_id, bucket по времени) | Bucket — статическое окно времени, чтобы партиции не росли бесконечно ([Discord 2023](https://discord.com/blog/how-discord-stores-trillions-of-messages)) |
| Instagram | user ID → логический шард | Тысячи логических шардов на меньшем числе физических ([Instagram, partial](https://instagram-engineering.com/sharding-ids-at-instagram-1cf5a71e5a5c)) |

**Tenant-based (по арендатору)** — лучший выбор для B2B/SaaS: изоляция, простые запросы, перенос клиента целиком. Риск — «кит» (огромный клиент) → Slack-проблема. Citus описывает tenant-шардирование для SaaS ([Citus tutorial](https://www.citusdata.com/blog/2017/03/09/multi-tenant-sharding-tutorial/); [sharding in plain English](https://www.citusdata.com/blog/2018/01/10/sharding-in-plain-english/)).

## 2. Hash vs range vs directory
- **Hash**: равномерно, но range-сканы по ключу неэффективны. Figma выбрала hash ключа, т.к. автоинкрементные и Snowflake-ID с префиксом времени дали бы hot spots ([Figma](https://www.figma.com/blog/how-figmas-databases-team-lived-to-tell-the-scale/)).
- **Range**: удобны диапазоны, но монотонные ключи (время, автоинкремент) создают горячий «последний» шард. Spanner прямо предупреждает о hotspot'ах от монотонных ключей ([Spanner schema design](https://cloud.google.com/spanner/docs/schema-design)).
- **Directory/lookup** (таблица «tenant → шард»): гибко, позволяет переносить отдельных клиентов; это путь Slack (metadata cluster) и Shopify (routing table) ([Slack](https://slack.engineering/scaling-datastores-at-slack-with-vitess/); [Shopify](https://shopify.engineering/mysql-database-shard-balancing-terabyte-scale)). Vitess формализует это через vindexes ([Vitess Vindexes](https://vitess.io/docs/reference/features/vindexes/)).

## 3. Логические шарды ≫ физических (ключевой приём)
- Notion: **480 логических шардов на 32 физических БД** (15 на БД); 480 выбрано, потому что делится на много чисел (32→40→48 хостов) — «Pick values with a lot of factors!» ([Notion](https://www.notion.com/blog/sharding-postgres-at-notion)).
- Позже Notion утроил парк 32 → 96 машин, просто переразложив логические схемы (15 → 5 на машину) через логическую репликацию Postgres ([The Great Re-shard](https://www.notion.com/blog/the-great-re-shard)).
- Instagram: логический шард = схема Postgres ([Instagram](https://instagram-engineering.com/sharding-ids-at-instagram-1cf5a71e5a5c)).
- Figma: логическое шардирование через Postgres views до физического разделения; откат логического — изменение конфигурации ([Figma](https://www.figma.com/blog/how-figmas-databases-team-lived-to-tell-the-scale/)).

## 4. Решардинг
- С логическими шардами решардинг = перенос целых логических шардов (Notion re-shard). Без них — перехеширование всех данных (дорого).
- Перенос арендатора: batch copy + хвост binlog/WAL + короткая блокировка на переключение (Shopify Ghostferry) ([Shopify](https://shopify.engineering/mysql-database-shard-balancing-terabyte-scale)); Stripe DocDB: регистрация → bulk import → async replication → correctness check → traffic switch ([Stripe DocDB](https://stripe.com/blog/how-stripes-document-databases-supported-99.999-uptime-with-zero-downtime-data-migrations)).
- **Не забудьте пулер соединений**: при переходе Notion 32→96 пришлось сначала шардировать PgBouncer, иначе число соединений выросло бы втрое ([Notion re-shard](https://www.notion.com/blog/the-great-re-shard)).

## 5. Cross-shard запросы и транзакции
- Scatter-gather запрос нагружает *все* шарды — столько же, как без шардирования; Figma ограничила поддерживаемый SQL: joins только внутри colo и по ключу ([Figma](https://www.figma.com/blog/how-figmas-databases-team-lived-to-tell-the-scale/)).
- Figma сознательно **не поддерживает атомарные cross-shard транзакции** — продукт должен переживать «partial commit failures» (там же).
- GitHub: линтеры запросов/транзакций, которые запрещают запросы через границы schema domains (в dev/test) и сэмплируют транзакции в проде ([GitHub](https://github.blog/engineering/infrastructure/partitioning-githubs-relational-databases-scale/)).
- Shopify pods: никаких действий через границы pod'ов; каждый запрос — один pod ([Shopify pods](https://shopify.engineering/a-pods-architecture-to-allow-shopify-to-scale)).
- Глобальные данные (справочники, пользователи) — отдельная нешардированная БД или репликация в каждый шард.
- Аналитика по всем шардам — через CDC в хранилище (Notion data lake, Stripe CDC).

## 6. Изоляция отказов
- Шардирование без изоляции ухудшает доступность: у Shopify код `with_each_shard` делал функцию недоступной при падении любого шарда → pods ([Shopify](https://shopify.engineering/a-pods-architecture-to-allow-shopify-to-scale)). Близкая идея — cells/shuffle sharding у AWS ([AWS](https://aws.amazon.com/builders-library/workload-isolation-using-shuffle-sharding/)).
- Hot partition: Discord ограничивал конкурентность к горячим партициям через data services с request coalescing и консистентным хешированием по channel_id ([Discord](https://discord.com/blog/how-discord-stores-trillions-of-messages)).

## Что делать / чего не делать

**Делать**
- Сейчас (даже без шардирования): `tenant_id`/`workspace_id` во всех таблицах арендатора, все запросы с ним, глобально уникальные ID.
- Если шардировать — много логических шардов (число с множеством делителей), маппинг в одном месте.
- Directory-таблица для B2B, чтобы переносить крупных клиентов.
- Запретить cross-shard запросы линтером, а не договорённостью.

**Не делать**
- Не использовать автоинкремент/время как range-ключ шардирования (hot spot).
- Не обещать атомарность между шардами; проектировать идемпотентные компенсирующие действия.
- Не шардировать, не решив, как будут работать пулинг соединений, бэкапы, миграции схем на N шардах.

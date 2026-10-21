# Когда НЕ шардировать: цифры из кейсов и лестница решений для одного сервера

> Уверенность: **H** для цифр — это самоотчёты компаний в их инженерных блогах (не независимая проверка); **M** — выводы для вашего масштаба.
> Дополняет [`01-scaling-ladder.md`](01-scaling-ladder.md) и [`05-case-studies.md`](05-case-studies.md) конкретными числами, чтобы было с чем сравнивать свою нагрузку.

## Главный вывод
Большинству продуктов шардинг не нужен никогда. Самый показательный кейс — **OpenAI**: по инженерному блогу «Scaling PostgreSQL to power 800 million ChatGPT users» (Bohan Zhang, 22 января 2026, [openai.com/index/scaling-postgresql](https://openai.com/index/scaling-postgresql/)):
- 800 млн пользователей ChatGPT обслуживает **один primary Azure PostgreSQL flexible server и почти 50 read-реплик** в разных регионах;
- миллионы запросов в секунду, p99 в «низких двузначных миллисекундах», пять девяток доступности;
- нагрузка за год выросла более чем в 10 раз — база так и осталась нешардированной;
- узкое место — **запись**: write-heavy нагрузки вынесены в Azure Cosmos DB; новые таблицы в этот Postgres больше не добавляют, новые нагрузки по умолчанию идут в шардированные системы;
- PgBouncer снизил среднее время соединения с 50 мс до 5 мс; лимит Azure — 5 000 соединений на инстанс;
- один запрос с JOIN 12 таблиц вызывал серьёзные инциденты;
- «We enforce a strict 5-second timeout on schema changes» — индексы только `CONCURRENTLY`.

Ваш масштаб — на порядки меньше. Значит: один Postgres на дедике Hetzner (64–128 ГБ RAM, NVMe) + PgBouncer + индексы + реплика + Redis-кэш закрывают всё обозримое будущее.

## Лестница с числами
| Шаг | Что | Пример из кейса |
|---|---|---|
| 1. Вертикально | Больше RAM/NVMe | Figma в 2020 жила на одном Postgres на самом большом инстансе AWS |
| 2. Индексы и запросы | `pg_stat_statements`, `EXPLAIN ANALYZE` | OpenAI: JOIN 12 таблиц → инциденты |
| 3. PgBouncer | transaction mode | OpenAI: 50 мс → 5 мс на соединение |
| 4. Read-реплики | для чтений, терпимых к лагу | OpenAI: ~50 реплик с одного primary; предел — primary стримит WAL каждой |
| 5. Кэш | Redis + защита от cache stampede (lock/lease) | OpenAI использует lease, чтобы один промах не породил тысячу запросов |
| 6. Партиционирование | `PARTITION BY RANGE (created_at)` | логи, события, свечи, транзакции |
| 7. Вертикальное разделение | группы таблиц → разные БД | Figma: дюжина БД к концу 2022 |
| 8. Горизонтальный шардинг | последняя ступень | Notion, Figma, Instagram — только когда упёрлись в запись/VACUUM/размер |

## Цифры шардинга у тех, кому он понадобился
- **Instagram (2012):** тысячи логических шардов как схемы Postgres; `user_id % N` → логический шард → таблица маппинга; ID = 41 бит времени + 13 бит шарда + 10 бит последовательности, генерируются PL/pgSQL в самой БД.
- **Notion (2021):** монолит упёрся в VACUUM и угрозу TXID wraparound. 480 логических шардов на 32 физических БД, ключ — workspace ID, лимиты 500 ГБ на таблицу и 10 ТБ на БД. 480 — потому что много делителей. **2023:** решардинг 32 → 96 машин через логическую репликацию.
- **Figma (2023–2024):** рост ~100× с 2020; отказались от CockroachDB/Spanner/NoSQL как рискованных; colos, логический шардинг через views, DBProxy (Go). Первый сплит — сентябрь 2023; на первую таблицу ушло 9 месяцев.
- **Discord:** Cassandra 2017 — 12 нод; 2022 — 177 нод, триллионы сообщений, горячие партиции, паузы GC. Rust-слой с request coalescing, затем ScyllaDB: мигратор 3,2 млн сообщений/с, 9 дней вместо ~3 месяцев. Итог 72 ноды, p99 чтения 40–125 мс → 15 мс.
- **Slack:** Vitess с 2017, через три года 99% нагрузки; пик 2,3 млн QPS, медиана 2 мс, p99 11 мс. В марте 2020 (+50% за неделю) горячие шарды делили онлайн.
- **Stripe DocDB:** > 5 млн запросов/с, тысячи шардов; Data Movement Platform в 2023 перенесла 1,5 ПБ и сократила число шардов примерно на три четверти.

## Что из этого брать прямо сейчас (без шардинга)
- `tenant_id`/`user_id` в каждой таблице и первым столбцом составных индексов — это будущий ключ шардинга, бесплатно.
- **UUIDv7** (встроенный `uuidv7()` в Postgres 18) или Snowflake-подобные 64-битные ID — не автоинкремент наружу.
- `SET lock_timeout = '5s'` в миграциях; expand → dual-write → backfill батчами с чекпоинтами → verify → cutover за флагом → contract.
- **Citus** — если шардинг по `tenant_id` всё-таки понадобится: распределённые таблицы вместо самописного роутинга. **TimescaleDB** — для временных рядов (цены, свечи, фандинг) со сжатием и retention-политиками.

## Что делать / чего не делать

**Делать**
- Сравнивать свои метрики с цифрами выше, прежде чем произносить слово «шардинг».
- Выносить аналитику (ClickHouse/реплика) раньше, чем делить OLTP.

**Не делать**
- Не строить DBProxy «как у Figma» одному — это 9 месяцев команды.
- Не считать чужие пороги своими: у вас другая нагрузка и другой профиль записи.

## Источники
- OpenAI — Scaling PostgreSQL to power 800 million ChatGPT users: https://openai.com/index/scaling-postgresql/
- Notion — Sharding Postgres at Notion: https://www.notion.com/blog/sharding-postgres-at-notion
- Notion — The Great Re-shard: https://www.notion.com/blog/the-great-re-shard
- Figma — How Figma's databases team lived to tell the scale: https://www.figma.com/blog/how-figmas-databases-team-lived-to-tell-the-scale/
- Discord — How Discord stores trillions of messages: https://discord.com/blog/how-discord-stores-trillions-of-messages
- Slack — Scaling datastores at Slack with Vitess: https://slack.engineering/scaling-datastores-at-slack-with-vitess/
- Stripe — DocDB и zero-downtime migrations: https://stripe.com/blog/how-stripes-document-databases-supported-99.999-uptime-with-zero-downtime-data-migrations
- Instagram — Sharding & IDs: https://instagram-engineering.com/sharding-ids-at-instagram-1cf5a71e5a5c

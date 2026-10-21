# Лестница масштабирования БД: что делать ДО шардирования

> Уверенность: **H** для фактов кейсов; **M** для порядка шагов (это синтез из кейсов Figma, Notion, GitHub, Shopify, Discord).
> Главная мысль: все крупные кейсы ниже сначала долго выжимали из одной БД всё возможное, и только потом шардировали.

## Как это было у компаний
- **Figma**: в 2020 — одна Postgres на крупнейшем инстансе AWS; к концу 2022 — кэширование, read replicas и дюжина **вертикально партиционированных** БД; только после этого — горизонтальное шардирование. Стек БД вырос «almost 100x since 2020» ([Figma](https://www.figma.com/blog/how-figmas-databases-team-lived-to-tell-the-scale/); ранний этап: [Figma 2023](https://www.figma.com/blog/how-figma-scaled-to-multiple-databases/)).
- **Notion**: «нажимать кнопку Resize Instance» — не долгосрочная стратегия; деградация (застревающий autovacuum, угроза TXID wraparound) начинается раньше аппаратного предела ([Notion](https://www.notion.com/blog/sharding-postgres-at-notion)).
- **GitHub**: сначала отдельные БД для функциональных групп, read replicas, ProxySQL для сокращения соединений; затем виртуальные партиции (schema domains) и перенос таблиц ([GitHub](https://github.blog/engineering/infrastructure/partitioning-githubs-relational-databases-scale/)).
- **Shopify**: шардировали в 2015, когда «no longer possible» купить сервер больше ([Shopify pods](https://shopify.engineering/a-pods-architecture-to-allow-shopify-to-scale)).
- **Discord**: MongoDB → Cassandra при ~100 млн сообщений, когда данные и индекс перестали помещаться в RAM ([Discord 2017](https://discord.com/blog/how-discord-stores-billions-of-messages)).

## Лестница (по порядку стоимости и риска)

| Шаг | Что | Признак, что пора | Источники |
|---|---|---|---|
| 0 | **Измерить**: `pg_stat_statements`, p95/p99 запросов, CPU/IOPS/соединения, размер таблиц, lag репликации | Всегда | [pg_stat_statements](https://www.postgresql.org/docs/current/pgstatstatements.html), [EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html) |
| 1 | **Индексы и запросы**: убрать N+1, seq scan по большим таблицам, добавить составные/частичные индексы (`CONCURRENTLY`) | Медленные запросы в топе | [Use The Index, Luke](https://use-the-index-luke.com/), [CREATE INDEX](https://www.postgresql.org/docs/current/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY), [CockroachDB index rules](https://www.cockroachlabs.com/blog/how-to-choose-db-index-keys/) |
| 2 | **Пулинг соединений** (PgBouncer / пулер провайдера) | Ошибки «too many connections», serverless | [PgBouncer](https://www.pgbouncer.org/features.html), [brandur](https://brandur.org/postgres-connections), [RDS Proxy](https://aws.amazon.com/rds/proxy/), [Postgres connections config](https://www.postgresql.org/docs/current/runtime-config-connection.html) |
| 3 | **Вертикальное масштабирование** (больше CPU/RAM/IOPS) | CPU/IOPS стабильно высоко | Figma, Notion (выше) |
| 4 | **Кэш** (CDN/ISR для публичных страниц, Redis для горячих ключей, материализованные агрегаты) | Повторяющиеся тяжёлые чтения | [AWS caching](https://aws.amazon.com/builders-library/caching-challenges-and-strategies/) |
| 5 | **Read replicas** (с учётом лага: read-your-writes!) | Чтения ≫ записей | [Hot Standby](https://www.postgresql.org/docs/current/hot-standby.html) |
| 6 | **Партиционирование таблиц** внутри одной БД (по времени для логов/тиков/свечей) | Огромные append-only таблицы, удаление старых данных | [Postgres partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html) |
| 7 | **Вертикальное разделение по доменам** (отдельные БД для групп таблиц) | Разные таблицы конкурируют за ресурсы | Figma, GitHub (выше) |
| 8 | **Архивирование/вынос аналитики** (data lake / OLAP) | Аналитические запросы мешают OLTP | [Notion data lake](https://www.notion.com/blog/building-and-scaling-notions-data-lake) |
| 9 | **Горизонтальное шардирование** | Один домен таблиц упирается в предел записи/размера/vacuum | см. `02-sharding-design.md` |

## Для Remainder-подобного дата-сайта (рекомендация, **M**)
- Тики/свечи/фандинг — append-only временные ряды: партиционировать по времени (дню/месяцу), хранить агрегаты (1m/1h/1d) в отдельных таблицах, старые партиции сжимать/выносить.
- Публичные страницы — из кэша/предрасчитанных таблиц; БД не должна получать запрос на каждый просмотр.
- Отдельная реплика (или OLAP) для тяжёлой аналитики.

## Что делать / чего не делать

**Делать**
- Мерить до оптимизации; держать `pg_stat_statements` включённым.
- Пройти шаги 1–7 до разговоров о шардировании.
- Партиционировать временные ряды по времени с самого начала, если объём заведомо большой.
- Учитывать лаг реплик: сразу после записи читать с primary.

**Не делать**
- Не шардировать «на вырост».
- Не открывать по соединению на запрос без пулера (особенно в serverless).
- Не прятать медленные запросы за кэшем, не поняв их причину.

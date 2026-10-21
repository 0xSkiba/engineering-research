# Кейсы: Notion, Figma, Instagram, Discord, Shopify, GitHub, Slack, Stripe

> Краткие карточки. Уверенность **H** (первоисточники), кроме Instagram (**M**, partial).

### Notion — шардирование Postgres (2021) и re-shard (2023)
- Причины: рост, застревающий autovacuum, угроза TXID wraparound ([Notion](https://www.notion.com/blog/sharding-postgres-at-notion)).
- Ключ: workspace ID; прикладное шардирование (решили не брать Citus/Vitess ради контроля над распределением).
- 480 логических шардов (схем) / 32 физические БД; лимиты 500 GB на таблицу и 10 TB на БД.
- Миграция: audit log + catch-up, backfill, dark reads, ~5 минут планового окна.
- Re-shard: 32 → 96 машин; логическая репликация; шардирование PgBouncer (≈100 инстансов × 6 соединений = 600 на шард; иначе стало бы 18 на старый шард); дальше — dark reads и переключение без простоя ([Great Re-shard](https://www.notion.com/blog/the-great-re-shard)).
- **Урок**: заранее заложить логические шарды с «удобным» числом; не забыть про слой соединений.

### Figma — от одной Postgres к горизонтальному шардированию
- 2020: одна Postgres на крупнейшем инстансе AWS → вертикальные партиции, реплики, кэш → горизонтальное шардирование (2023–2024) ([Figma](https://www.figma.com/blog/how-figmas-databases-team-lived-to-tell-the-scale/)).
- Рассматривали CockroachDB, TiDB, Spanner, Vitess и NoSQL; выбрали своё решение поверх RDS Postgres ради низкого риска и сохранения экспертизы.
- DBProxy (Go): парсинг SQL, логический/физический планировщик, load shedding; colos; hash-маршрутизация; views для логических шардов; нет атомарных cross-shard транзакций; поддержан подмножество SQL, покрывающее ~90% запросов (определено «shadow planning» на продакшен-трафике).
- **Урок**: отделить логическое шардирование (дёшево откатить) от физического (дорого откатить).

### Instagram — ID и логические шарды (2012)
- Тысячи логических шардов (схемы Postgres) на небольшом числе серверов; 64-битные ID: 41 бит времени, 13 бит шарда, 10 бит последовательности ([Instagram](https://instagram-engineering.com/sharding-ids-at-instagram-1cf5a71e5a5c); прочитано через поисковый индекс — partial).
- **Урок**: простые «скучные» решения внутри Postgres вместо отдельного сервиса.

### Discord — хранение сообщений
- 2015: MongoDB; ~100 млн сообщений (ноябрь 2015) — данные и индекс перестали помещаться в RAM → Cassandra; ключ (channel_id, bucket) + Snowflake message_id ([2017](https://discord.com/blog/how-discord-stores-billions-of-messages)).
- 2022: 177 узлов Cassandra, «trillions of messages», hot partitions, GC-паузы → ScyllaDB (72 узла); промежуточные data services на Rust с request coalescing; миграция со скоростью до 3.2 млн сообщений/с; p99 чтения истории: 40–125 мс → 15 мс ([2023](https://discord.com/blog/how-discord-stores-trillions-of-messages)).
- **Урок**: защищать БД от горячих ключей на уровне приложения (coalescing, ограничение конкурентности), а не только менять движок.

### Shopify — pods
- 2015 — шардирование MySQL; затем pods: набор магазинов на полностью изолированных хранилищах, каждый запрос — один pod, роутинг Sorting Hat; Pod Mover перемещает pod в резервный ДЦ ([pods](https://shopify.engineering/a-pods-architecture-to-allow-shopify-to-scale)).
- Балансировка: перенос магазина между шардами через Ghostferry (batch copy + binlog) ([shard balancing](https://shopify.engineering/mysql-database-shard-balancing-terabyte-scale)).
- **Урок**: шардирование без изоляции отказов ухудшает доступность.

### GitHub — партиционирование MySQL
- Ранее один основной кластер `mysql1`; schema domains + линтеры запросов/транзакций; перенос через Vitess или write-cutover; к 2021 — нагрузка на хосты бывшего `mysql1` снижена на 50% ([GitHub](https://github.blog/engineering/infrastructure/partitioning-githubs-relational-databases-scale/)).
- Апгрейд до MySQL 8.0 с постепенной выкаткой реплик и сохранением возможности отката ([GitHub MySQL 8.0](https://github.blog/engineering/infrastructure/upgrading-github-com-to-mysql-8-0/)).
- **Урок**: сначала «виртуальное» разделение с машинной проверкой границ, потом физическое.

### Slack — Vitess
- Шардирование по workspace упёрлось в крупнейших клиентов и новые продукты (Enterprise Grid, Slack Connect); миграция на Vitess с 2017; 99% нагрузки на Vitess на момент публикации; 2.3 млн QPS в пике ([Slack](https://slack.engineering/scaling-datastores-at-slack-with-vitess/)).
- **Урок**: tenant-шардирование ломается на «китах» и cross-tenant функциях — заложите directory-слой.

### Stripe — онлайн-миграции и DocDB
- 4 шага миграции + Scientist для проверки путей чтения ([Online migrations](https://stripe.com/blog/online-migrations)).
- DocDB: >5 млн запросов/с, 2 000+ шардов; Data Movement Platform — регистрация, bulk import, async replication, correctness check, traffic switch; ключевая фаза — секунды ([DocDB](https://stripe.com/blog/how-stripes-document-databases-supported-99.999-uptime-with-zero-downtime-data-migrations)).

### Uber — Schemaless и уход с Postgres (2016)
- В начале 2014 Uber «running out of database space» на Postgres для данных поездок; построили Schemaless — append-only шардированный MySQL с неизменяемыми ячейками, триггерами и глобальными индексами. Shard-поле индекса должно хорошо распределяться: «UUIDs are best, city ids are suboptimal», enum-статусы вредны; индексы eventually consistent (обычно лаг <20 мс) ([Schemaless part one](https://www.uber.com/blog/schemaless-part-one-mysql-datastore/), прочитано через WebFetch).
- Причины ухода с Postgres (на опыте Postgres 9.2): write amplification при обновлении многих индексов, многословная физическая репликация, баг с повреждением данных на репликах, трудные мажорные апгрейды, проблемы с сотнями активных соединений (pgbouncer помогал) ([Why Uber switched](https://www.uber.com/blog/postgres-to-mysql-migration/)). Часть аргументов относится к старым версиям; сегодня в Postgres есть логическая репликация ([docs](https://www.postgresql.org/docs/current/logical-replication.html)) — **M**, оценивайте актуальность.
- **Урок**: выбор ключа шардирования (высокая кардинальность, неизменяемость) и операционное доверие к системе важнее модности технологии.

## Что делать / чего не делать

**Делать**
- Учиться на последовательности шагов, а не на конечной архитектуре гигантов.
- Брать приёмы, полезные уже сейчас: tenant_id везде, глобальные ID, линтер границ модулей, dark reads при миграциях.

**Не делать**
- Не строить «свой DBProxy» соло-разработчиком; при реальной необходимости — управляемые решения (Citus, Vitess/PlanetScale и др.).
- Не воспринимать цифры из кейсов как пороги для себя — у вас другая нагрузка.

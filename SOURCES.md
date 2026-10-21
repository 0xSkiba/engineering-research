# Реестр первичных источников

Все страницы открыты при исследовании **2026-10-21**. Исторические даты относятся к публикациям/инцидентам, а не к проверке текущего стека компании. Пересказы краткие, полные тексты не копируются.

## S01

**Google — What to look for in a code review**

- Тип: первичный источник.
- Дата/версия: дата не указана.
- Ссылка: [Google — What to look for in a code review](https://google.github.io/eng-practices/review/reviewer/looking-for.html).
- Что подтверждает и ограничение: Практика review; не статистика качества всех команд Google.
- Проверено: 2026-10-21.

## S02

**Shopify — Under Deconstruction: The State of Shopify’s Monolith**

- Тип: первичный источник.
- Дата/версия: 2020-09-16.
- Ссылка: [Shopify — Under Deconstruction: The State of Shopify’s Monolith](https://shopify.engineering/shopify-monolith).
- Что подтверждает и ограничение: Исторический опыт компонентного монолита.
- Проверено: 2026-10-21.

## S03

**GitHub — Partitioning relational databases**

- Тип: первичный источник.
- Дата/версия: 2021-09-27; обновлено 2022-03-02.
- Ссылка: [GitHub — Partitioning relational databases](https://github.blog/engineering/infrastructure/partitioning-githubs-relational-databases-scale/).
- Что подтверждает и ограничение: Schema domains, SQL linters, физическое разделение.
- Проверено: 2026-10-21.

## S04

**Discord — How Discord Stores Trillions of Messages**

- Тип: первичный источник.
- Дата/версия: 2023-03-06.
- Ссылка: [Discord — How Discord Stores Trillions of Messages](https://discord.com/blog/how-discord-stores-trillions-of-messages).
- Что подтверждает и ограничение: Горячие партиции, coalescing, миграция; не универсальный benchmark БД.
- Проверено: 2026-10-21.

## S05

**Stripe — Online migrations at scale**

- Тип: первичный источник.
- Дата/версия: 2017-02-02.
- Ссылка: [Stripe — Online migrations at scale](https://stripe.com/blog/online-migrations).
- Что подтверждает и ограничение: Поэтапное изменение subscriptions; не готовый протокол межшардовой транзакции.
- Проверено: 2026-10-21.

## S06

**Amazon — Timeouts, retries, and backoff with jitter**

- Тип: первичный источник.
- Дата/версия: 2019-12-05.
- Ссылка: [Amazon — Timeouts, retries, and backoff with jitter](https://builder.aws.com/content/3EumjoZascWd1oZiEgL8ORlv3qE/timeouts-retries-and-backoff-with-jitter).
- Что подтверждает и ограничение: Таймауты, побочные эффекты, бюджеты повторов.
- Проверено: 2026-10-21.

## S07

**Google SRE Workbook — Canarying Releases**

- Тип: первичный источник.
- Дата/версия: глава книги; дата страницы не установлена.
- Ссылка: [Google SRE Workbook — Canarying Releases](https://sre.google/workbook/canarying-releases/).
- Что подтверждает и ограничение: Canary, flags, оценка релиза на части трафика.
- Проверено: 2026-10-21.

## S08

**GitLab — Postmortem of database outage of January 31**

- Тип: первичный источник.
- Дата/версия: инцидент 2017-01-31.
- Ссылка: [GitLab — Postmortem of database outage of January 31](https://about.gitlab.com/blog/postmortem-of-database-outage-of-january-31/).
- Что подтверждает и ограничение: Первичный разбор удаления primary и проблем восстановления.
- Проверено: 2026-10-21.

## S09

**OpenZeppelin — Uniswap v4 Periphery and Universal Router Audit**

- Тип: первичный источник.
- Дата/версия: 2024-08-30.
- Ссылка: [OpenZeppelin — Uniswap v4 Periphery and Universal Router Audit](https://www.openzeppelin.com/news/uniswap-v4-periphery-and-universal-router-audit).
- Что подтверждает и ограничение: Публичные находки конкретного scope/commit. Аудитор — заинтересованный первичный источник.
- Проверено: 2026-10-21.

## S10

**PostgreSQL — Table Partitioning**

- Тип: первичный источник.
- Дата/версия: документация; при открытии версия 18.
- Ссылка: [PostgreSQL — Table Partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html).
- Что подтверждает и ограничение: Встроенное разбиение таблиц, свойства и ограничения.
- Проверено: 2026-10-21.

## S11

**OWASP API4 — Unrestricted Resource Consumption**

- Тип: первичный источник.
- Дата/версия: редакция 2023.
- Ссылка: [OWASP API4 — Unrestricted Resource Consumption](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/).
- Что подтверждает и ограничение: Ограничения ресурсов и затрат; учебные сценарии не выдаются за инциденты.
- Проверено: 2026-10-21.

## S12

**OWASP API6 — Unrestricted Access to Sensitive Business Flows**

- Тип: первичный источник.
- Дата/версия: редакция 2023.
- Ссылка: [OWASP API6 — Unrestricted Access to Sensitive Business Flows](https://api-security.owasp.org/editions/2023/en/0xa6-unrestricted-access-to-sensitive-business-flows/).
- Что подтверждает и ограничение: Автоматизация бизнес-действий и защитные меры.
- Проверено: 2026-10-21.

## S13

**Cloudflare — Rate limiting best practices**

- Тип: первичный источник.
- Дата/версия: живая документация.
- Ссылка: [Cloudflare — Rate limiting best practices](https://developers.cloudflare.com/waf/rate-limiting-rules/best-practices/).
- Что подтверждает и ограничение: Лимиты операций и сложности. Возможности зависят от плана; цены не исследованы.
- Проверено: 2026-10-21.

## S14

**OWASP — Authorization Cheat Sheet**

- Тип: первичный источник.
- Дата/версия: живая документация.
- Ссылка: [OWASP — Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).
- Что подтверждает и ограничение: Least privilege, deny by default, проверки на каждый запрос.
- Проверено: 2026-10-21.

## S15

**OWASP — SQL Injection Prevention**

- Тип: первичный источник.
- Дата/версия: живая документация.
- Ссылка: [OWASP — SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html).
- Что подтверждает и ограничение: Параметризованные запросы и allowlist.
- Проверено: 2026-10-21.

## S16

**OWASP — SSRF Prevention**

- Тип: первичный источник.
- Дата/версия: живая документация.
- Ссылка: [OWASP — SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).
- Что подтверждает и ограничение: Контроль назначения серверных запросов.
- Проверено: 2026-10-21.

## S17

**Solidity — Security Considerations**

- Тип: первичный источник.
- Дата/версия: живая документация; 0.8.38-develop при открытии.
- Ссылка: [Solidity — Security Considerations](https://docs.soliditylang.org/en/latest/security-considerations.html).
- Что подтверждает и ограничение: Устойчивые классы риска; development-версия не рекомендуется для deployment.
- Проверено: 2026-10-21.

## Пробелы и доступ

OWASP Bot Management and Anti-Automation Cheat Sheet не удалось открыть через исследовательский инструмент; её содержимое не использовано как доказательство. Не исследованы тарифы средств защиты, реальные production-конфигурации перечисленных компаний и частота ошибок среди новичков. Рекомендации по реализации необходимо адаптировать к стеку и проверять нагрузкой.

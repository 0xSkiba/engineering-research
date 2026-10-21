# Клиентские базы данных / CRM: модель данных, PII, GDPR, аудит, soft delete, multitenancy

> ⚠️ **Не юридическая консультация.** Всё про GDPR/UK GDPR/иные законы о персональных данных здесь — инженерный конспект. Для обязательств (основания обработки, DPA с подрядчиками, сроки хранения, уведомления о breach, трансграничная передача) нужен юрист.
> Уверенность: **H** для цитат законов и документации; **M** для архитектурных рекомендаций.

## 1. Модель данных
- **Отделяйте PII от остального**: таблица `contacts_pii` (email, телефон, имя, адрес) отдельно от `contacts` (id, tenant_id, статусы, связи). Это упрощает шифрование, доступ, удаление и экспорт.
- **Минимизация данных**: GDPR Art. 5 — данные «limited to what is necessary» (data minimisation) и хранятся не дольше нужного (storage limitation) ([Art. 5](https://gdpr-info.eu/art-5-gdpr/)). Не собирайте «на всякий случай».
- **Privacy by design / by default** — Art. 25 ([Art. 25](https://gdpr-info.eu/art-25-gdpr/)).
- **Безопасность обработки**: Art. 32 упоминает «pseudonymisation and encryption» ([Art. 32](https://gdpr-info.eu/art-32-gdpr/)).
- **Утечка**: уведомить надзорный орган «not later than 72 hours» после того, как стало известно (где применимо) ([Art. 33](https://gdpr-info.eu/art-33-gdpr/)). Значит, нужны логи, позволяющие понять масштаб утечки.
- **Право на удаление** — Art. 17 ([Art. 17](https://gdpr-info.eu/art-17-gdpr/)); справочно: [Еврокомиссия](https://commission.europa.eu/law/law-topic/data-protection_en), [ICO (UK GDPR)](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/).
- **Реальная цена ошибок**: регулятор Австралии (OAIC) подал иск к Optus, утверждая серьёзное вмешательство в приватность ~9.5 млн человек; максимальный штраф — до A$2.22 млн за каждое нарушение ([OAIC](https://www.oaic.gov.au/news/media-centre/oaic-takes-civil-penalty-action-against-optus)).

## 2. Multitenancy (B2B CRM)
Три модели ([AWS: PostgreSQL patterns for SaaS](https://aws.amazon.com/blogs/database/choose-the-right-postgresql-data-access-pattern-for-your-saas-application/); [Citus: SaaS DB for scale](https://www.citusdata.com/blog/2016/10/03/designing-your-saas-database-for-high-scalability/)):

| Модель | Изоляция | Сложность | Когда |
|---|---|---|---|
| Общие таблицы + `tenant_id` (pool) | Логическая (RLS) | Низкая | Почти всегда для старта |
| Схема на арендатора (bridge) | Средняя | Миграции × N | Мало крупных клиентов |
| БД на арендатора (silo) | Сильная | Высокая | Регуляторные требования, enterprise |

- **Postgres RLS** как второй рубеж: без политики действует default-deny, **но владелец таблицы обычно обходит RLS**, пока не включён `FORCE ROW LEVEL SECURITY`; роли с `BYPASSRLS` обходят всегда ([Postgres RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)). Приложение должно ходить в БД НЕ под владельцем таблиц.
- Supabase: таблица в exposed-схеме без RLS читаема/записываема любой ролью с grant ([Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)).
- Шаблоны RLS для тенантов: [Crunchy Data](https://www.crunchydata.com/blog/row-level-security-for-tenants-in-postgres), [AWS](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/).
- OWASP Multi-Tenant cheat sheet: устанавливать tenant-контекст рано, из проверенной сервером идентичности, и не давать downstream-компонентам заменять его непроверенным вводом; учитывать noisy neighbors и кэш-ключи с tenant ([OWASP Multi Tenant](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html)).
- Пример SQL: `examples/db/tenant-rls.sql`.

## 3. Soft delete vs hard delete
- `deleted_at` выглядит просто, но: «утекает» в каждый запрос (забыли `WHERE deleted_at IS NULL` → показали удалённое), ломает внешние ключи и уникальные индексы, а undelete часто не работает. Brandur предлагает альтернативу — таблицу `deleted_record` с JSONB-копией ([Soft Deletion Probably Isn't Worth It](https://brandur.org/soft-deletion)).
- Конфликт с правом на удаление: «мягко удалённые» PII всё ещё хранятся. Нужна политика: soft delete → через N дней hard delete/анонимизация PII (срок N — решает юрист).
- Atlassian 2022: скрипт удаления принимал и ID сайта, и ID приложения без подтверждения типа — 775 клиентов потеряли доступ до 14 дней ([Atlassian PIR](https://www.atlassian.com/engineering/post-incident-review-april-2022-outage)). Мораль: опасные удаления — с soft-delete-периодом, dry-run и проверкой типа объекта.

## 4. Аудит-лог
- Отдельная append-only таблица: `who` (actor_id, роль, ip, user_agent), `what` (action, entity, entity_id), `when`, `tenant_id`, `before/after` (без секретов). Приложение не имеет прав UPDATE/DELETE на неё.
- Что логировать и чего НЕ логировать (пароли, токены сессий, полные номера карт, лишние PII) — [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).
- Логировать **чтение** PII в админке (кто открыл карточку клиента) — именно это нужно при расследовании утечки.

## 5. Доступ сотрудников/агентов
- Минимальные роли; доступ к PII в проде — через админку с аудитом, не через «прямой SQL».
- **AI-агентам — никакого доступа к прод-БД с PII.** Для разработки — синтетические/анонимизированные данные. Кейс Replit: агент удалил продакшен-базу во время «code freeze» ([The Register](https://www.theregister.com/software/2025/07/21/vibe-coding-service-replit-deleted-production-database/719783)).

## 6. Экспорт, импорт, бэкапы
- Экспорт данных клиента (portability) и удаление — как отдельные протестированные функции.
- Бэкапы шифровать; **регулярно проверять восстановление** (GitLab 2017: бэкапы фактически не работали — [postmortem](https://about.gitlab.com/blog/2017/02/10/postmortem-of-database-outage-of-january-31/)).
- Помнить, что PII живёт и в бэкапах, логах, аналитике, у подрядчиков (Ledger: утечка базы клиентов через API-ключ к e-commerce/маркетинговой БД — [rekt: Ledger](https://rekt.news/ledger-rekt/)).

## Что делать / чего не делать

**Делать**
- `tenant_id NOT NULL` в каждой бизнес-таблице + RLS + проверка в коде (два рубежа).
- Отдельное хранение PII, шифрование чувствительных полей, минимизация.
- Append-only аудит-лог, включая чтение PII.
- Процедуры удаления/экспорта по запросу и проверенное восстановление из бэкапа.
- Показать юристу: какие данные, зачем, где хранятся, кто подрядчики, сроки хранения.

**Не делать**
- Не подключать приложение к БД под ролью-владельцем таблиц (RLS будет обойдён).
- Не логировать PII/токены «для отладки».
- Не давать AI-агентам прод-доступ и реальные клиентские данные.
- Не делать необратимые массовые удаления без dry-run и подтверждения типа объекта.

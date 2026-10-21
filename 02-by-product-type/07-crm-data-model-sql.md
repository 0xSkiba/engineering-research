# CRM и клиентские данные: модель, аудит, PII, RLS, мультитенантность — с SQL

> Уверенность: **H** для фактов о Supabase/Stripe/Postgres; **M** для схем — рабочие шаблоны. Не юридическая консультация (GDPR — к юристу).
> Практическое дополнение к [`05-crm-customer-databases.md`](05-crm-customer-databases.md); готовый SQL — [`../examples/db/tenant-rls.sql`](../examples/db/tenant-rls.sql).

## Моделирование
- Ядро в 3НФ: `customers`, `contacts`, `companies`, `deals`, `activities`. JSONB с GIN-индексом — только для кастомных полей клиента, не для ядра.
- Каждая таблица: `id uuid` (v7), `tenant_id uuid NOT NULL`, `created_at timestamptz`, `updated_at timestamptz`, `created_by uuid`.
- PII отдельно: `contacts_pii (contact_id, email_enc, phone_enc, email_hmac, phone_hmac)` — шифрование полей (envelope encryption, мастер-ключ в KMS/Vault) + HMAC для поиска по точному совпадению.
- Составные индексы начинаются с `tenant_id`: `(tenant_id, created_at)`, `(tenant_id, stage)` — это и производительность, и будущий ключ шардинга (Notion шардирует по workspace).

## Аудит-лог
```sql
CREATE TABLE audit_log (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  tenant_id   uuid NOT NULL,
  actor_id    uuid,
  actor_ip    inet,
  action      text NOT NULL,          -- 'contact.read' | 'contact.update' | 'export' ...
  entity      text NOT NULL,
  entity_id   uuid,
  diff        jsonb,                  -- before/after без секретов
  at          timestamptz NOT NULL DEFAULT now()
);
REVOKE UPDATE, DELETE ON audit_log FROM app_user;   -- append-only
```
Пишется в той же транзакции, что и изменение. Логировать и **чтение** PII в админке — это то, что нужно при расследовании утечки (GDPR Art. 33: уведомление регулятора в 72 часа требует понимать масштаб).

## Soft delete и GDPR
- `deleted_at` — для восстановления по ошибке, но с плановой жёсткой очисткой/анонимизацией PII через N дней (N — решает юрист).
- Частичный уникальный индекс: `CREATE UNIQUE INDEX ON contacts (tenant_id, email_hmac) WHERE deleted_at IS NULL`.
- Удаление должно доходить до проекций, кэша, файлов и бэкапов (политика retention бэкапов).

## RLS как второй рубеж
```sql
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;   -- иначе владелец таблицы обходит RLS
CREATE POLICY tenant_isolation ON customers
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
-- в каждой транзакции приложения:
-- SET LOCAL app.tenant_id = '<uuid из серверной сессии>';
```
- С PgBouncer в transaction mode — только `SET LOCAL`, не `SET` (иначе контекст утечёт в чужую транзакцию).
- Роль приложения — **не владелец таблиц** и без `BYPASSRLS`; миграции — под отдельной ролью.
- Supabase строит доступ именно на RLS: политики выполняются в БД, поэтому забытый `WHERE` в коде не утечёт чужие данные ([Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)).

## Мультитенантность: какую модель выбрать
| Паттерн | Когда правильно | Минусы |
|---|---|---|
| Общая схема + `tenant_id` (+ RLS) | По умолчанию; тысячи мелких клиентов | Риск утечки без RLS; «шумные соседи» |
| Схема на тенанта | Десятки–сотни клиентов, кастомизация | Миграции × N, раздутый каталог |
| БД на тенанта | Крупные/регулируемые клиенты, резидентность данных | Дорогая эксплуатация |

Гибрид, как у Stripe: Data Movement Platform переводит клиента из мультитенантной инфраструктуры в single-tenant и обратно без простоя. HubSpot и большинство SaaS-CRM — общая модель с portal/tenant id в ключах.

Рекомендация для старта: **общая схема + `tenant_id` в каждой таблице и первым столбцом индексов + RLS**. Это же открывает путь к Citus/шардингу по `tenant_id` без переписывания запросов.

## Доступ сотрудников и агентов
- PII в проде — через админку с аудитом, не через «прямой SQL».
- AI-агентам — никакого доступа к прод-БД с PII; dev — на синтетических данных.

## Что делать / чего не делать

**Делать**
- `tenant_id NOT NULL` везде + RLS + проверка в коде — два рубежа.
- Append-only аудит с чтением PII; шифрование PII-полей; retention.
- Отдельные функции «экспорт клиента» и «удалить клиента», покрытые тестами.

**Не делать**
- Не подключать приложение под владельцем таблиц.
- Не хранить PII «на всякий случай» и не логировать её.
- Не делать массовые удаления без dry-run и проверки типа объекта (Atlassian 2022).

## Источники
- Supabase — Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- PostgreSQL — Row Security Policies: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- Stripe — DocDB и Data Movement Platform: https://stripe.com/blog/how-stripes-document-databases-supported-99.999-uptime-with-zero-downtime-data-migrations
- AWS — Multi-tenant data isolation with PostgreSQL RLS: https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/
- GDPR Art. 32, 33: https://gdpr-info.eu/art-32-gdpr/ · https://gdpr-info.eu/art-33-gdpr/

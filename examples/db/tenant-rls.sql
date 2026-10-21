-- Мультитенантность в Postgres: tenant_id в каждой таблице + Row Level Security
-- как второй рубеж против IDOR. Документация: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
--
-- ВАЖНО:
--  * владелец таблицы и роли с BYPASSRLS обходят RLS. Приложение должно ходить
--    под отдельной ролью без BYPASSRLS и не владельцем таблиц; FORCE ROW LEVEL SECURITY
--    распространяет политику и на владельца.
--  * app.tenant_id выставляется через set_config(..., true) внутри транзакции
--    (важно для PgBouncer в transaction-режиме: не используйте SET на сессию).

-- 1. Роли
CREATE ROLE app_owner NOLOGIN;                 -- владеет схемой, миграции
CREATE ROLE app_user  LOGIN PASSWORD 'change-me-from-secret-manager' NOBYPASSRLS;

-- 2. Таблица
CREATE TABLE watchlists (
  id          uuid PRIMARY KEY,                -- UUIDv7 генерируется в приложении (examples/db/ids.ts)
  tenant_id   uuid NOT NULL,
  name        text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  symbols     text[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE watchlists OWNER TO app_owner;
-- индекс начинается с tenant_id: все запросы фильтруют по нему (и это будущий shard key)
CREATE INDEX watchlists_tenant_idx ON watchlists (tenant_id, created_at DESC);

-- 3. RLS
ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlists FORCE ROW LEVEL SECURITY;

-- current_setting(..., true) вернёт NULL, если контекст не выставлен → ни одна строка не видна (fail-closed)
CREATE POLICY tenant_isolation ON watchlists
  USING      (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON watchlists TO app_user;

-- 4. Использование из приложения (в одной транзакции):
--   BEGIN;
--   SELECT set_config('app.tenant_id', '6f1c...uuid', true);
--   SELECT * FROM watchlists WHERE id = $1 AND tenant_id = $2;   -- явный фильтр всё равно оставляем
--   COMMIT;

-- 5. Проверка в CI (должно вернуть 0 строк без контекста):
--   SET ROLE app_user; SELECT count(*) FROM watchlists;  -- ожидаем 0
--   RESET ROLE;

-- 6. Аудит-лог: append-only, приложение может только вставлять
CREATE TABLE audit_log (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id   uuid,
  actor_id    uuid,
  action      text NOT NULL,          -- 'watchlist.update', 'apikey.create', ...
  target_type text,
  target_id   text,
  ip          inet,
  meta        jsonb NOT NULL DEFAULT '{}'::jsonb,  -- без паролей/токенов/лишних PII
  at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE audit_log OWNER TO app_owner;
GRANT INSERT ON audit_log TO app_user;              -- без UPDATE/DELETE
GRANT USAGE ON SEQUENCE audit_log_id_seq TO app_user;

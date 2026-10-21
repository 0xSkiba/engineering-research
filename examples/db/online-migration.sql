-- Онлайн-миграция по схеме expand → migrate → contract на Postgres.
-- Пример: переименовать users.name → users.display_name без простоя.
-- Каждый шаг — отдельный деплой; между шагами проверка метрик.
-- См. 04-database-scaling-and-sharding/04-online-migrations.md

-- Общие правила для каждой DDL-миграции:
SET lock_timeout = '3s';         -- не висеть в очереди за долгой транзакцией и не блокировать всех
SET statement_timeout = '15min';

-- ШАГ 1 (expand): добавить колонку. Nullable без DEFAULT — мгновенно.
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name text;

-- ШАГ 2 (деплой кода): приложение пишет в ОБЕ колонки (dual write), читает из старой.

-- ШАГ 3 (migrate): бэкфилл батчами, чтобы не держать долгие блокировки и не раздувать WAL/реплики.
-- Повторять, пока UPDATE возвращает > 0 строк (в скрипте/джобе с паузой между батчами).
UPDATE users
   SET display_name = name
 WHERE id IN (
   SELECT id FROM users
    WHERE display_name IS NULL AND name IS NOT NULL
    ORDER BY id
    LIMIT 5000
 );

-- ШАГ 4: проверка расхождений (должно быть 0)
SELECT count(*) FROM users WHERE display_name IS DISTINCT FROM name;

-- ШАГ 5 (деплой кода): читать из новой колонки (можно сначала «shadow read»: читать обе и логировать расхождения).

-- ШАГ 6: ограничения без долгой блокировки — NOT VALID, затем VALIDATE отдельно
ALTER TABLE users ADD CONSTRAINT users_display_name_nn CHECK (display_name IS NOT NULL) NOT VALID;
ALTER TABLE users VALIDATE CONSTRAINT users_display_name_nn;

-- Индексы — только CONCURRENTLY (вне транзакции; при ошибке остаётся INVALID-индекс — удалить и повторить)
CREATE INDEX CONCURRENTLY IF NOT EXISTS users_display_name_idx ON users (display_name);

-- ШАГ 7 (деплой кода): перестать писать в старую колонку.

-- ШАГ 8 (contract, через несколько дней, после бэкапа):
-- ALTER TABLE users DROP COLUMN name;

-- Чего НЕ делать в одной миграции на большой таблице:
--   ALTER TABLE ... ALTER COLUMN ... TYPE ...  (переписывает таблицу под эксклюзивной блокировкой)
--   CREATE INDEX без CONCURRENTLY
--   UPDATE всей таблицы одним запросом
--   переименование колонки, которую читает уже задеплоенный код

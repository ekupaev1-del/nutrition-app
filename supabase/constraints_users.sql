-- Сделать telegram_id обязательным и уникальным, чтобы исключить дубликаты и пустые значения
-- ВАЖНО: перед выполнением убедись, что нет строк с NULL в telegram_id
-- Пример очистки: DELETE FROM users WHERE telegram_id IS NULL;
ALTER TABLE public.users
  ALTER COLUMN telegram_id SET NOT NULL;

-- Индекс уникальности по telegram_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'users_telegram_id_key'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_telegram_id_key UNIQUE (telegram_id);
  END IF;
END $$;

-- Дополнительно: запретить вставку, если почему-то ещё остаётся попытка вставить NULL
-- (защитный слой поверх NOT NULL; будет избыточным, но даст понятную ошибку)
CREATE OR REPLACE FUNCTION public.users_block_null_telegram_id()
RETURNS trigger AS $$
BEGIN
  IF NEW.telegram_id IS NULL THEN
    RAISE EXCEPTION 'telegram_id cannot be NULL';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_block_null ON public.users;
CREATE TRIGGER trg_users_block_null
BEFORE INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.users_block_null_telegram_id();



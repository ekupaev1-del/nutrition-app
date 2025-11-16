-- Удалить все строки без telegram_id (мусорные записи)
DELETE FROM public.users WHERE telegram_id IS NULL;



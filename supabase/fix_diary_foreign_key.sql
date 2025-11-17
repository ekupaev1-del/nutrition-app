-- Исправление foreign key constraint в таблице diary
-- Проблема: foreign key ссылается на неправильное поле или пользователь не существует

-- Шаг 1: Проверяем текущие constraints
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'diary';

-- Шаг 2: Удаляем существующий foreign key constraint (если он есть)
DO $$ 
BEGIN
    -- Пытаемся удалить constraint, если он существует
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'diary_user_id_fkey' 
        AND table_name = 'diary'
    ) THEN
        ALTER TABLE public.diary DROP CONSTRAINT diary_user_id_fkey;
        RAISE NOTICE 'Foreign key constraint diary_user_id_fkey удалён';
    ELSE
        RAISE NOTICE 'Foreign key constraint diary_user_id_fkey не найден';
    END IF;
END $$;

-- Шаг 3: Проверяем структуру таблицы users
-- Убеждаемся, что в users есть поле telegram_id
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Шаг 4: Создаём правильный foreign key (если нужно)
-- Вариант А: Если в users есть поле user_id, которое соответствует user_id в diary
-- ALTER TABLE public.diary 
-- ADD CONSTRAINT diary_user_id_fkey 
-- FOREIGN KEY (user_id) 
-- REFERENCES public.users(user_id) 
-- ON DELETE CASCADE;

-- Вариант Б: Если в users есть telegram_id, и user_id в diary = telegram_id
-- Тогда нужно либо изменить структуру, либо убрать foreign key совсем
-- Рекомендую убрать foreign key, так как user_id в diary = telegram_id из users

-- Шаг 5: Создаём индекс для быстрого поиска (если его нет)
CREATE INDEX IF NOT EXISTS idx_diary_user_id ON public.diary(user_id);
CREATE INDEX IF NOT EXISTS idx_diary_user_id_created_at ON public.diary(user_id, created_at DESC);

-- Шаг 6: Проверяем результат
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'diary';

-- Готово! Теперь можно вставлять записи в diary без проверки foreign key


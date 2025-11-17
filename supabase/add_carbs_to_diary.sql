-- Добавление поля carbs (углеводы) в таблицу diary
-- Если поле уже существует, скрипт не выдаст ошибку

-- Проверяем, существует ли поле carbs
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'diary' 
        AND column_name = 'carbs'
    ) THEN
        -- Добавляем поле carbs
        ALTER TABLE public.diary 
        ADD COLUMN carbs NUMERIC(10, 2) DEFAULT 0;
        
        RAISE NOTICE 'Поле carbs успешно добавлено в таблицу diary';
    ELSE
        RAISE NOTICE 'Поле carbs уже существует в таблице diary';
    END IF;
END $$;

-- Проверяем результат
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'diary'
  AND column_name IN ('calories', 'protein', 'fat', 'carbs')
ORDER BY ordinal_position;


-- Упрощённая версия создания таблицы meals (без внешнего ключа)
-- Используйте эту версию, если основная версия выдаёт ошибку с foreign key

CREATE TABLE IF NOT EXISTS public.meals (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  telegram_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  description TEXT,
  calories NUMERIC(10, 2),
  protein NUMERIC(10, 2),
  fat NUMERIC(10, 2),
  carbs NUMERIC(10, 2),
  type TEXT NOT NULL CHECK (type IN ('text', 'photo', 'audio'))
);

-- Индекс для быстрого поиска по telegram_id и дате
CREATE INDEX IF NOT EXISTS idx_meals_telegram_id_created_at 
  ON public.meals(telegram_id, created_at DESC);

-- Индекс для поиска по telegram_id
CREATE INDEX IF NOT EXISTS idx_meals_telegram_id 
  ON public.meals(telegram_id);

-- Комментарии к таблице
COMMENT ON TABLE public.meals IS 'Таблица для хранения приёмов пищи пользователей';
COMMENT ON COLUMN public.meals.telegram_id IS 'Telegram ID пользователя';
COMMENT ON COLUMN public.meals.description IS 'Описание блюда (от пользователя или от OpenAI)';
COMMENT ON COLUMN public.meals.type IS 'Тип ввода: text, photo, audio';
COMMENT ON COLUMN public.meals.calories IS 'Калорийность в ккал';
COMMENT ON COLUMN public.meals.protein IS 'Белки в граммах';
COMMENT ON COLUMN public.meals.fat IS 'Жиры в граммах';
COMMENT ON COLUMN public.meals.carbs IS 'Углеводы в граммах';


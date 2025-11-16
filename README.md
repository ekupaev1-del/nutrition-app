# Мой путь к балансу

Нежное пошаговое приложение на Next.js, которое собирает ключевые данные о пользователе, рассчитывает дневную норму калорий и макроэлементов по формуле Миффлина — Сан Жеора, сохраняет результаты в Supabase и работает как PWA.

## Быстрый старт

1. Установи зависимости:
   ```bash
   npm install
   # или
   pnpm install
   ```
2. Скопируй `.env.example` в `.env.local` и заполни переменные:
   ```bash
   cp .env.example .env.local
   ```
3. Запусти проект:
   ```bash
   npm run dev
   ```
4. Открой [http://localhost:3000](http://localhost:3000) и пройди пошаговую анкету.

## Supabase

Создай таблицу `users` со столбцами:

| Имя        | Тип      |
|------------|----------|
| id         | uuid (primary key, default uuid_generate_v4()) |
| gender     | text     |
| age        | int2/int4|
| height     | numeric  |
| weight     | numeric  |
| activity   | text     |
| goal       | text     |
| calories   | numeric  |
| protein    | numeric  |
| fat        | numeric  |
| carbs      | numeric  |
| created_at | timestamptz (default now()) |

Настрой переменные окружения:

- `SUPABASE_URL` — URL проекта (https://...supabase.co)
- `SUPABASE_SERVICE_ROLE_KEY` — сервисный ключ (храни его только на сервере!)

## PWA

Приложение содержит `manifest.json`, сервис-воркер `public/sw.js` и регистрирует его в `app/layout.tsx`. После первого визита ты сможешь добавить приложение на домашний экран.

## Технологии

- Next.js 14 (app router)
- TypeScript
- Tailwind CSS
- Framer Motion (анимации переходов)
- Supabase (`@supabase/supabase-js`)
- PWA (manifest + service worker)

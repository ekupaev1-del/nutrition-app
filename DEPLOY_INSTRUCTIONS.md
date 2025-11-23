# Инструкция по деплою на Vercel

## Проблема с автодеплоем

Автодеплой через GitHub webhook не работает. Используйте один из вариантов ниже.

## Вариант 1: Deploy Hook (рекомендуется)

1. Откройте Vercel Dashboard → Settings → Git → Deploy Hooks
2. Создайте новый хук:
   - Name: `Manual Deploy`
   - Branch: `main`
3. Скопируйте URL хука
4. Используйте для деплоя:
   ```bash
   curl -X POST YOUR_DEPLOY_HOOK_URL
   ```

## Вариант 2: Ручной деплой через Vercel CLI

```bash
npx vercel --prod
```

Требует авторизации в Vercel.

## Вариант 3: Проверка webhook в GitHub

1. GitHub → Settings → Webhooks
2. Найдите webhook для Vercel
3. Проверьте последние доставки (Recent Deliveries)
4. Если есть ошибки - переподключите репозиторий в Vercel

## Текущие настройки

- Ignored Build Step: Custom с `exit 1` (всегда билдить)
- Репозиторий: ekupaev1-del/nutrition-app
- Branch: main


#!/bin/bash
# Скрипт для принудительного триггера деплоя Vercel

echo "🔄 Триггер деплоя через GitHub push..."

# Создаем файл с временной меткой
TIMESTAMP=$(date +%s)
echo "$TIMESTAMP" > .deploy-timestamp

git add .deploy-timestamp
git commit -m "Deploy trigger: $TIMESTAMP" --allow-empty
git push origin main

echo "✅ Коммит отправлен. Проверьте Vercel через 1-2 минуты."


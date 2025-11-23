#!/bin/bash
# Скрипт для деплоя на Vercel через Deploy Hook

DEPLOY_HOOK_URL="https://api.vercel.com/v1/integrations/deploy/prj_HgqvxqZKHrcr7rnn2O8S14JzTlGN/X9YdI7jr6Z"

echo "🚀 Запуск деплоя на Vercel..."
echo ""

response=$(curl -X POST "$DEPLOY_HOOK_URL" -s)

if [ $? -eq 0 ]; then
    echo "✅ Деплой запущен успешно!"
    echo ""
    echo "📊 Ответ от Vercel:"
    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    echo ""
    echo "⏳ Проверьте статус деплоя в Vercel Dashboard → Deployments"
else
    echo "❌ Ошибка при запуске деплоя"
    exit 1
fi


#!/bin/bash
echo "🚀 Прямой деплой на Vercel через CLI..."
npx vercel --prod --yes --token=$VERCEL_TOKEN 2>&1

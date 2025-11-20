import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Функция для отправки сообщения через Telegram Bot API
async function sendTelegramMessage(telegramId: number, text: string, keyboard?: any) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error("[/api/save] TELEGRAM_BOT_TOKEN не установлен");
    return;
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const payload: any = {
    chat_id: telegramId,
    text: text,
    parse_mode: "HTML"
  };

  if (keyboard) {
    payload.reply_markup = keyboard;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!result.ok) {
      console.error("[/api/save] Ошибка отправки сообщения в Telegram:", result);
    } else {
      console.log("[/api/save] ✅ Сообщение отправлено в Telegram");
    }
  } catch (error) {
    console.error("[/api/save] Ошибка при отправке сообщения:", error);
  }
}

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const url = new URL(req.url);
  const userId = url.searchParams.get("id");

  if (!userId) {
    console.error("[/api/save] Нет id в URL");
    return NextResponse.json(
      { ok: false, error: "ID отсутствует в URL" },
      { status: 400 }
    );
  }

  const numericId = Number(userId);
  if (!Number.isFinite(numericId)) {
    console.error("[/api/save] Некорректный id (не число):", userId);
    return NextResponse.json(
      { ok: false, error: "ID должен быть числом" },
      { status: 400 }
    );
  }

  const body = await req.json();
  const {
    gender,
    age,
    weight,
    height,
    activity,
    goal,
    calories,
    protein,
    fat,
    carbs
  } = body;

  console.log("[/api/save] UPDATE users by id:", numericId, {
    gender,
    age,
    weight,
    height,
    activity,
    goal,
    calories,
    protein,
    fat,
    carbs
  });

  // ВАЖНО: Только UPDATE, никаких INSERT/UPSERT!
  // Форма НИКОГДА не должна создавать новые строки в users.
  // Бот создаёт строку при /start, форма только обновляет существующую.
  const { data, error } = await supabase
    .from("users")
    .update({
      gender,
      age,
      weight,
      height,
      activity,
      goal,
      calories,
      protein,
      fat,
      carbs
    })
    .eq("id", numericId)
    .select("id, telegram_id");

  if (error) {
    console.error("[/api/save] supabase error:", error);
    // Если ошибка связана с telegram_id - это значит кто-то пытается создать строку
    // Этого не должно происходить, так как мы делаем только UPDATE
    if (error.message?.includes("telegram_id")) {
      console.error("[/api/save] КРИТИЧЕСКАЯ ОШИБКА: Попытка создать строку без telegram_id!");
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (!data || data.length === 0) {
    console.error("[/api/save] Не найден пользователь с id:", numericId);
    // НИ В КОЕМ СЛУЧАЕ не создаём новую строку!
    return NextResponse.json(
      { ok: false, error: "Пользователь с таким id не найден. Запустите /start в боте" },
      { status: 404 }
    );
  }

  const user = data[0];
  console.log("[/api/save] OK updated id:", numericId);

  // Отправляем сообщение с меню через Telegram Bot API
  if (user.telegram_id) {
    const updateUrl = `https://nutrition-app4.vercel.app/?id=${user.id}`;
    const statsUrl = `https://nutrition-app4.vercel.app/stats?id=${user.id}`;
    
    const messageText = "✅ Отлично! Анкета сохранена.\n\n📸 Теперь вы можете отправлять фото, текст и аудио того, что кушаете, и бот проанализирует всё!";
    
    const keyboard = {
      keyboard: [
        [
          { text: "✏️ Обновить анкету", web_app: { url: updateUrl } }
        ],
        [
          { text: "📋 Получить отчет", web_app: { url: statsUrl } }
        ],
        [
          { text: "✏️ Редактировать прием пищи" }
        ],
        [
          { text: "💡 Рекомендации" }
        ]
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    };

    // Отправляем сообщение асинхронно (не блокируем ответ)
    sendTelegramMessage(user.telegram_id, messageText, keyboard).catch(err => {
      console.error("[/api/save] Ошибка отправки сообщения:", err);
    });
  } else {
    console.warn("[/api/save] У пользователя нет telegram_id, сообщение не отправлено");
  }

  return NextResponse.json({ ok: true, id: user.id });
}

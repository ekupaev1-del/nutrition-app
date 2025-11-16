// Подключаем dotenv и фиксируем путь к .env
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, ".env") });

// Telegram + Supabase
import { Telegraf } from "telegraf";
import { createClient } from "@supabase/supabase-js";

// Получаем переменные окружения
const token = process.env.TELEGRAM_BOT_TOKEN!;
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!token || !supabaseUrl || !supabaseKey) {
  console.error("❌ Ошибка: переменные окружения не загружены!");
  console.log({
    TELEGRAM_BOT_TOKEN: token,
    SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: supabaseKey
  });
  process.exit(1);
}

// Инициализация
const bot = new Telegraf(token);
const supabase = createClient(supabaseUrl, supabaseKey);

// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
//            /start
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

bot.start(async (ctx) => {
  try {
    const telegram_id = ctx.from?.id;
    if (!telegram_id) {
      console.error("[bot] /start: нет telegram_id");
      return ctx.reply("Ошибка: не удалось определить ваш Telegram ID");
    }

    console.log(`[bot] /start вызван для telegram_id: ${telegram_id}`);

    // Проверяем, есть ли пользователь
    const { data: existingUser, error: selectError } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_id", telegram_id)
      .maybeSingle();

    if (selectError) {
      console.error("[bot] Ошибка проверки пользователя:", selectError);
      return ctx.reply("Ошибка базы данных. Попробуйте позже.");
    }

    let userId;

    if (existingUser) {
      userId = existingUser.id;
      console.log(`[bot] Пользователь найден, id: ${userId}`);
    } else {
      // Создаём новую запись ТОЛЬКО с telegram_id
      // Форма потом обновит остальные поля через /api/save
      console.log(`[bot] Создание новой записи для telegram_id: ${telegram_id}`);
      const { data: upserted, error: upsertError } = await supabase
        .from("users")
        .upsert({ telegram_id }, { onConflict: "telegram_id", ignoreDuplicates: false })
        .select("id")
        .single();

      if (upsertError) {
        console.error("[bot] Ошибка upsert:", upsertError);
        return ctx.reply("Ошибка создания записи в базе. Попробуйте позже.");
      }

      if (!upserted?.id) {
        console.error("[bot] Upsert вернул пустой результат");
        return ctx.reply("Ошибка: не удалось получить ID пользователя");
      }

      userId = upserted.id;
      console.log(`[bot] Создана новая запись, id: ${userId}`);
    }

    // URL Mini-App с корректным id
    const url = `https://nutrition-app4.vercel.app/?id=${userId}`;
    console.log(`[bot] Ссылка на анкету: ${url}`);

    // Отправляем кнопку Mini App
    await ctx.reply("Нажми кнопку, чтобы пройти анкету 👇", {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Заполнить анкету",
              web_app: { url }
            }
          ]
        ]
      }
    });

    console.log(`[bot] /start успешно завершён для id: ${userId}`);
  } catch (err) {
    console.error("[bot] Критическая ошибка /start:", err);
    ctx.reply("Произошла ошибка, попробуйте позже.");
  }
});

// Корректное завершение
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

// Стартуем
bot.launch();
console.log("🤖 Бот запущен");
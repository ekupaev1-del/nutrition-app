// Подключаем dotenv и фиксируем путь к .env
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, ".env") });

// Telegram + Supabase + OpenAI
import { Telegraf } from "telegraf";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

// Получаем переменные окружения
const token = process.env.TELEGRAM_BOT_TOKEN!;
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const openaiApiKey = process.env.OPENAI_API_KEY!;

if (!token || !supabaseUrl || !supabaseKey || !openaiApiKey) {
  console.error("❌ Ошибка: переменные окружения не загружены!");
  console.log({
    TELEGRAM_BOT_TOKEN: token,
    SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: supabaseKey,
    OPENAI_API_KEY: openaiApiKey ? "✅" : "❌"
  });
  process.exit(1);
}

// Инициализация
const bot = new Telegraf(token);
const supabase = createClient(supabaseUrl, supabaseKey);
const openai = new OpenAI({ apiKey: openaiApiKey });

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

// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
//      Вспомогательные функции
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

interface MealAnalysis {
  description: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

async function analyzeFoodWithOpenAI(userInput: string): Promise<MealAnalysis | null> {
  try {
    const prompt = `Ты — эксперт по питанию. Проанализируй описание еды и верни ТОЛЬКО JSON в следующем формате:
{
  "description": "краткое название блюда на русском",
  "calories": число (ккал),
  "protein": число (граммы),
  "fat": число (граммы),
  "carbs": число (граммы)
}

Описание от пользователя: "${userInput}"

Если пользователь описал несколько блюд или порцию, оцени общее количество. Будь точным, но если точных данных нет — используй средние значения для подобных блюд.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Ты — помощник по анализу питания. Всегда возвращай валидный JSON без дополнительного текста."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error("[OpenAI] Пустой ответ");
      return null;
    }

    const parsed = JSON.parse(content);
    return {
      description: parsed.description || userInput,
      calories: Number(parsed.calories) || 0,
      protein: Number(parsed.protein) || 0,
      fat: Number(parsed.fat) || 0,
      carbs: Number(parsed.carbs) || 0
    };
  } catch (error) {
    console.error("[OpenAI] Ошибка анализа:", error);
    return null;
  }
}

async function getUserDailyNorm(telegram_id: number): Promise<{
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
} | null> {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("calories, protein, fat, carbs")
      .eq("telegram_id", telegram_id)
      .maybeSingle();

    if (error) {
      console.error("[getUserDailyNorm] Ошибка:", error);
      return null;
    }

    if (!data || !data.calories) {
      return null;
    }

    return {
      calories: Number(data.calories) || 0,
      protein: Number(data.protein) || 0,
      fat: Number(data.fat) || 0,
      carbs: Number(data.carbs) || 0
    };
  } catch (error) {
    console.error("[getUserDailyNorm] Исключение:", error);
    return null;
  }
}

async function getTodayMeals(telegram_id: number): Promise<{
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const { data, error } = await supabase
      .from("meals")
      .select("calories, protein, fat, carbs")
      .eq("telegram_id", telegram_id)
      .gte("created_at", todayISO);

    if (error) {
      console.error("[getTodayMeals] Ошибка:", error);
      return { calories: 0, protein: 0, fat: 0, carbs: 0 };
    }

    const totals = (data || []).reduce(
      (acc, meal) => ({
        calories: acc.calories + Number(meal.calories || 0),
        protein: acc.protein + Number(meal.protein || 0),
        fat: acc.fat + Number(meal.fat || 0),
        carbs: acc.carbs + Number(meal.carbs || 0)
      }),
      { calories: 0, protein: 0, fat: 0, carbs: 0 }
    );

    return totals;
  } catch (error) {
    console.error("[getTodayMeals] Исключение:", error);
    return { calories: 0, protein: 0, fat: 0, carbs: 0 };
  }
}

function formatProgressMessage(
  eaten: { calories: number; protein: number; fat: number; carbs: number },
  norm: { calories: number; protein: number; fat: number; carbs: number } | null
): string {
  if (!norm) {
    return `Вы уже съели сегодня:\n🔥 ${eaten.calories} ккал\n🥚 ${eaten.protein.toFixed(1)} г белков\n🥥 ${eaten.fat.toFixed(1)} г жиров\n🍚 ${eaten.carbs.toFixed(1)} г углеводов\n\n⚠️ Пройдите анкету, чтобы увидеть дневную норму.`;
  }

  const remaining = {
    calories: Math.max(0, norm.calories - eaten.calories),
    protein: Math.max(0, norm.protein - eaten.protein),
    fat: Math.max(0, norm.fat - eaten.fat),
    carbs: Math.max(0, norm.carbs - eaten.carbs)
  };

  return `Вы уже съели сегодня:\n🔥 ${eaten.calories} / ${norm.calories} ккал (осталось: ${remaining.calories})\n🥚 ${eaten.protein.toFixed(1)} / ${norm.protein.toFixed(1)} г белков (осталось: ${remaining.protein.toFixed(1)})\n🥥 ${eaten.fat.toFixed(1)} / ${norm.fat.toFixed(1)} г жиров (осталось: ${remaining.fat.toFixed(1)})\n🍚 ${eaten.carbs.toFixed(1)} / ${norm.carbs.toFixed(1)} г углеводов (осталось: ${remaining.carbs.toFixed(1)})`;
}

// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
//      Обработка текстовых сообщений
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

bot.on("text", async (ctx) => {
  try {
    const telegram_id = ctx.from?.id;
    if (!telegram_id) {
      return ctx.reply("Ошибка: не удалось определить ваш Telegram ID");
    }

    const text = ctx.message.text.trim();

    // Игнорируем команды
    if (text.startsWith("/")) {
      return;
    }

    console.log(`[bot] Текстовое сообщение от ${telegram_id}: ${text}`);

    // Показываем, что обрабатываем
    const processingMsg = await ctx.reply("🔍 Анализирую еду...");

    // Анализируем через OpenAI
    const analysis = await analyzeFoodWithOpenAI(text);
    if (!analysis) {
      await ctx.telegram.editMessageText(
        ctx.chat!.id,
        processingMsg.message_id,
        undefined,
        "❌ Не удалось проанализировать еду. Попробуйте описать подробнее."
      );
      return;
    }

    // Сохраняем в базу
    const { error: insertError } = await supabase.from("meals").insert({
      telegram_id,
      description: analysis.description,
      calories: analysis.calories,
      protein: analysis.protein,
      fat: analysis.fat,
      carbs: analysis.carbs,
      type: "text"
    });

    if (insertError) {
      console.error("[bot] Ошибка сохранения:", insertError);
      await ctx.telegram.editMessageText(
        ctx.chat!.id,
        processingMsg.message_id,
        undefined,
        "❌ Ошибка сохранения в базу данных."
      );
      return;
    }

    // Получаем статистику за сегодня
    const todayMeals = await getTodayMeals(telegram_id);
    const dailyNorm = await getUserDailyNorm(telegram_id);

    // Формируем ответ
    const response = `✅ Добавлено:\n${analysis.description}\n🔥 ${analysis.calories} ккал | 🥚 ${analysis.protein.toFixed(1)}г | 🥥 ${analysis.fat.toFixed(1)}г | 🍚 ${analysis.carbs.toFixed(1)}г\n\n${formatProgressMessage(todayMeals, dailyNorm)}`;

    await ctx.telegram.editMessageText(
      ctx.chat!.id,
      processingMsg.message_id,
      undefined,
      response
    );
  } catch (error) {
    console.error("[bot] Ошибка обработки текста:", error);
    ctx.reply("Произошла ошибка при обработке сообщения.");
  }
});

// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
//      Команда /отменить
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

bot.command("отменить", async (ctx) => {
  try {
    const telegram_id = ctx.from?.id;
    if (!telegram_id) {
      return ctx.reply("Ошибка: не удалось определить ваш Telegram ID");
    }

    // Находим последнюю запись за сегодня
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const { data: lastMeal, error: selectError } = await supabase
      .from("meals")
      .select("id, description, calories")
      .eq("telegram_id", telegram_id)
      .gte("created_at", todayISO)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (selectError) {
      console.error("[bot] Ошибка поиска:", selectError);
      return ctx.reply("❌ Ошибка базы данных.");
    }

    if (!lastMeal) {
      return ctx.reply("❌ Сегодня ещё не было добавлено ни одного приёма пищи.");
    }

    // Удаляем
    const { error: deleteError } = await supabase
      .from("meals")
      .delete()
      .eq("id", lastMeal.id);

    if (deleteError) {
      console.error("[bot] Ошибка удаления:", deleteError);
      return ctx.reply("❌ Ошибка удаления.");
    }

    // Получаем обновлённую статистику
    const todayMeals = await getTodayMeals(telegram_id);
    const dailyNorm = await getUserDailyNorm(telegram_id);

    ctx.reply(
      `✅ Удалено: ${lastMeal.description} (${lastMeal.calories} ккал)\n\n${formatProgressMessage(todayMeals, dailyNorm)}`
    );
  } catch (error) {
    console.error("[bot] Ошибка /отменить:", error);
    ctx.reply("Произошла ошибка.");
  }
});

// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
//      Команда /отчет
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

bot.command("отчет", async (ctx) => {
  try {
    const telegram_id = ctx.from?.id;
    if (!telegram_id) {
      return ctx.reply("Ошибка: не удалось определить ваш Telegram ID");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const { data: meals, error } = await supabase
      .from("meals")
      .select("description, calories, protein, fat, carbs, created_at")
      .eq("telegram_id", telegram_id)
      .gte("created_at", todayISO)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[bot] Ошибка получения отчёта:", error);
      return ctx.reply("❌ Ошибка базы данных.");
    }

    if (!meals || meals.length === 0) {
      return ctx.reply("📋 Сегодня ещё не было приёмов пищи.");
    }

    const todayMeals = await getTodayMeals(telegram_id);
    const dailyNorm = await getUserDailyNorm(telegram_id);

    let report = "📋 Отчёт за сегодня:\n\n";
    meals.forEach((meal, index) => {
      const time = new Date(meal.created_at).toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit"
      });
      report += `${index + 1}. ${meal.description} (${time})\n   🔥 ${meal.calories} ккал | 🥚 ${Number(meal.protein).toFixed(1)}г | 🥥 ${Number(meal.fat).toFixed(1)}г | 🍚 ${Number(meal.carbs).toFixed(1)}г\n\n`;
    });

    report += `\n${formatProgressMessage(todayMeals, dailyNorm)}`;

    ctx.reply(report);
  } catch (error) {
    console.error("[bot] Ошибка /отчет:", error);
    ctx.reply("Произошла ошибка.");
  }
});

// TODO: Добавить обработку фото (photo)
// TODO: Добавить обработку аудио (audio)
// TODO: Добавить напоминания
// TODO: Добавить графики веса
// TODO: Добавить CSV-экспорт
// TODO: Добавить советы по питанию

// Корректное завершение
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

// Стартуем
bot.launch();
console.log("🤖 Бот запущен");
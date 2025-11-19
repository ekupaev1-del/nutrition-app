// Подключаем dotenv и фиксируем путь к .env
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { Readable } from "stream";

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
    TELEGRAM_BOT_TOKEN: token ? "✅" : "❌",
    SUPABASE_URL: supabaseUrl ? "✅" : "❌",
    SUPABASE_SERVICE_ROLE_KEY: supabaseKey ? "✅" : "❌",
    OPENAI_API_KEY: openaiApiKey ? "✅" : "❌"
  });
  
  if (!openaiApiKey || openaiApiKey === "sk-your-openai-api-key-here") {
    console.error("\n⚠️  ВНИМАНИЕ: OPENAI_API_KEY не настроен!");
    console.error("   Добавьте ваш OpenAI API ключ в файл bot/.env");
    console.error("   Получить ключ: https://platform.openai.com/api-keys\n");
  }
  
  process.exit(1);
}

// Проверяем, что API ключ не заглушка
if (openaiApiKey === "sk-your-openai-api-key-here") {
  console.error("❌ OPENAI_API_KEY содержит заглушку! Замените на реальный ключ в bot/.env");
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

    // Проверяем, есть ли пользователь и заполнена ли анкета
    const { data: existingUser, error: selectError } = await supabase
      .from("users")
      .select("id, calories")
      .eq("telegram_id", telegram_id)
      .maybeSingle();

    if (selectError) {
      console.error("[bot] Ошибка проверки пользователя:", selectError);
      return ctx.reply("Ошибка базы данных. Попробуйте позже.");
    }

    let userId;
    const isQuestionnaireFilled = existingUser && existingUser.calories;

    if (existingUser) {
      userId = existingUser.id;
      console.log(`[bot] Пользователь найден, id: ${userId}, анкета заполнена: ${isQuestionnaireFilled}`);
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

    // Если анкета не заполнена - показываем приветствие
    if (!isQuestionnaireFilled) {
      const url = `https://nutrition-app4.vercel.app/?id=${userId}`;
      console.log(`[bot] Показываю приветствие для нового пользователя`);

      // Отправляем приветственное сообщение с картинкой
      await ctx.replyWithPhoto(
        "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&h=600&fit=crop",
        {
          caption: "👋 Привет! Ты в боте по питанию.\n\n📝 Заполни анкету, чтобы начать отслеживать своё питание и получать персональные рекомендации!",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "📝 Заполнить анкету",
                  web_app: { url }
                }
              ]
            ]
          }
        }
      );
      return;
    }

    // Если анкета заполнена - показываем обычное меню
    const statsUrl = `https://nutrition-app4.vercel.app/stats?id=${userId}`;
    const updateUrl = `https://nutrition-app4.vercel.app/?id=${userId}`;
    
    await ctx.reply("Добро пожаловать! Выберите действие:", {
      reply_markup: {
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
      }
    });

    console.log(`[bot] /start успешно завершён для id: ${userId}`);
  } catch (err) {
    console.error("[bot] Критическая ошибка /start:", err);
    ctx.reply("Произошла ошибка, попробуйте позже.");
  }
});

// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
//      Обработка данных из WebApp
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

// Обработка данных из WebApp (когда пользователь отправляет данные через sendData)
bot.on("message", async (ctx, next) => {
  // Проверяем, есть ли данные из WebApp
  if (ctx.message && "web_app_data" in ctx.message) {
    try {
      const telegram_id = ctx.from?.id;
      if (!telegram_id) {
        return next();
      }

      const data = (ctx.message as any).web_app_data?.data;
      if (!data) {
        return next();
      }

      let parsedData;
      try {
        parsedData = JSON.parse(data);
      } catch (e) {
        console.error("[bot] Ошибка парсинга данных из WebApp:", e);
        return next();
      }

      // Если анкета сохранена - отправляем приветственное сообщение с меню
      if (parsedData.action === "questionnaire_saved") {
        // Получаем userId для создания ссылок на Mini App
        const { data: user } = await supabase
          .from("users")
          .select("id")
          .eq("telegram_id", telegram_id)
          .maybeSingle();

        if (user) {
          const updateUrl = `https://nutrition-app4.vercel.app/?id=${user.id}`;
          const statsUrl = `https://nutrition-app4.vercel.app/stats?id=${user.id}`;
          
          await ctx.reply(
            "✅ Отлично! Анкета сохранена.\n\n📸 Сейчас ты можешь отправить фото, аудио, голосовое сообщение или текст с описанием еды, и я проанализирую её!",
            {
              reply_markup: {
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
              }
            }
          );
        } else {
          await ctx.reply(
            "✅ Отлично! Анкета сохранена.\n\n📸 Сейчас ты можешь отправить фото, аудио, голосовое сообщение или текст с описанием еды, и я проанализирую её!"
          );
        }
        return; // Не передаем управление дальше
      }
    } catch (error) {
      console.error("[bot] Ошибка обработки web_app_data:", error);
    }
    // Если это web_app_data, не передаем дальше
    return;
  }
  
  // Для всех остальных сообщений передаем управление дальше
  return next();
});

// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
//            /help
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

bot.command("help", async (ctx) => {
  const helpText = `📋 Доступные команды:

/start - Начать работу с ботом и пройти анкету

📝 Добавление еды:
• Отправьте текстовое сообщение с описанием еды
• Отправьте фото еды
• Отправьте голосовое сообщение с описанием еды

📊 Управление:
/отменить - Удалить последнее блюдо за сегодня
/отчет - Показать полный отчёт за сегодня

Примеры:
• "куриная грудка 200г с рисом"
• "яблоко и банан"
• "салат цезарь"

Бот автоматически определит калории и Б/Ж/У! 🎯`;

  await ctx.reply(helpText);
});

bot.command("помощь", async (ctx) => {
  const helpText = `📋 Доступные команды:

/start - Начать работу с ботом и пройти анкету

📝 Добавление еды:
• Отправьте текстовое сообщение с описанием еды
• Отправьте фото еды
• Отправьте голосовое сообщение с описанием еды

📊 Управление:
/отменить - Удалить последнее блюдо за сегодня
/отчет - Показать полный отчёт за сегодня

Примеры:
• "куриная грудка 200г с рисом"
• "яблоко и банан"
• "салат цезарь"

Бот автоматически определит калории и Б/Ж/У! 🎯`;

  await ctx.reply(helpText);
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
    console.log(`[OpenAI] Начинаю анализ: "${userInput}"`);
    
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

    console.log("[OpenAI] Отправляю запрос к OpenAI (модель: gpt-4o)...");
    let response;
    try {
      response = await openai.chat.completions.create({
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
    } catch (modelError: any) {
      // Если gpt-4o недоступна, пробуем gpt-4o-mini
      if (modelError?.code === "model_not_found" || modelError?.message?.includes("gpt-4o")) {
        console.log("[OpenAI] gpt-4o недоступна, пробую gpt-4o-mini...");
        response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
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
      } else {
        throw modelError;
      }
    }

    console.log("[OpenAI] Получен ответ от OpenAI");
    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error("[OpenAI] Пустой ответ от OpenAI");
      return null;
    }

    console.log(`[OpenAI] Содержимое ответа: ${content.substring(0, 200)}...`);
    
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error("[OpenAI] Ошибка парсинга JSON:", parseError);
      console.error("[OpenAI] Сырой ответ:", content);
      return null;
    }

    const result = {
      description: parsed.description || userInput,
      calories: Number(parsed.calories) || 0,
      protein: Number(parsed.protein) || 0,
      fat: Number(parsed.fat) || 0,
      carbs: Number(parsed.carbs) || 0
    };

    console.log(`[OpenAI] Успешно проанализировано:`, result);
    return result;
  } catch (error: any) {
    console.error("[OpenAI] Ошибка анализа:", error);
    if (error?.message) {
      console.error("[OpenAI] Детали ошибки:", error.message);
    }
    if (error?.response) {
      console.error("[OpenAI] Ответ API:", error.response);
    }
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
      .from("diary")
      .select("calories, protein, fat, carbs")
      .eq("user_id", telegram_id)
      .gte("created_at", todayISO);

    if (error) {
      console.error("[getTodayMeals] Ошибка:", error);
      return { calories: 0, protein: 0, fat: 0, carbs: 0 };
    }

    const totals: { calories: number; protein: number; fat: number; carbs: number } = (data || []).reduce<{ calories: number; protein: number; fat: number; carbs: number }>(
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

    // Кнопки "✏️ Обновить анкету" и "📋 Получить отчет" теперь напрямую открывают Mini App через web_app в keyboard button
    // Обработчики текста не нужны, так как кнопки не отправляют текст при нажатии - они напрямую открывают Mini App

    if (text === "✏️ Редактировать прием пищи") {
      // Получаем userId для Mini App
      const { data: user } = await supabase
        .from("users")
        .select("id")
        .eq("telegram_id", telegram_id)
        .maybeSingle();

      if (!user) {
        return ctx.reply("❌ Пользователь не найден. Используйте /start для регистрации.");
      }

      const editUrl = `https://nutrition-app4.vercel.app/stats?id=${user.id}&view=edit`;
      const updateUrl = `https://nutrition-app4.vercel.app/?id=${user.id}`;
      const statsUrl = `https://nutrition-app4.vercel.app/stats?id=${user.id}`;

      // Показываем подменю с прямой ссылкой на Mini App для редактора
      const keyboardButtons: any[] = [
        [
          { text: "❌ Удалить последний прием пищи" }
        ],
        [
          { text: "📝 Открыть редактор приемов пищи", web_app: { url: editUrl } }
        ],
        [
          { text: "🔙 Назад в меню" }
        ]
      ];

      return ctx.reply("Выберите действие:", {
        reply_markup: {
          keyboard: keyboardButtons,
          resize_keyboard: true,
          one_time_keyboard: false
        }
      });
    }

    // Кнопка "📝 Открыть редактор приемов пищи" теперь напрямую открывает Mini App через web_app в keyboard button
    // Обработчик текста не нужен, так как кнопка не отправляет текст при нажатии - она напрямую открывает Mini App

    if (text === "❌ Удалить последний прием пищи") {
      // Используем существующую логику команды /отменить
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      const { data: lastMeal, error: selectError } = await supabase
        .from("diary")
        .select("id, meal_text, calories")
        .eq("user_id", telegram_id)
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

      const { error: deleteError } = await supabase
        .from("diary")
        .delete()
        .eq("id", lastMeal.id);

      if (deleteError) {
        console.error("[bot] Ошибка удаления:", deleteError);
        return ctx.reply("❌ Ошибка удаления.");
      }

      const todayMeals = await getTodayMeals(telegram_id);
      const dailyNorm = await getUserDailyNorm(telegram_id);

      // Получаем userId для создания ссылок на Mini App
      const { data: user } = await supabase
        .from("users")
        .select("id")
        .eq("telegram_id", telegram_id)
        .maybeSingle();

      const updateUrl = user ? `https://nutrition-app4.vercel.app/?id=${user.id}` : "";
      const statsUrl = user ? `https://nutrition-app4.vercel.app/stats?id=${user.id}` : "";

      // Возвращаем в главное меню
      const keyboardButtons: any[] = [
        [
          { text: "✏️ Обновить анкету", web_app: user ? { url: updateUrl } : undefined }
        ],
        [
          { text: "📋 Получить отчет", web_app: user ? { url: statsUrl } : undefined }
        ],
        [
          { text: "✏️ Редактировать прием пищи" }
        ],
        [
          { text: "💡 Рекомендации" }
        ]
      ];

      await ctx.reply(
        `✅ Удалено: ${lastMeal.meal_text} (${lastMeal.calories} ккал)\n\n${formatProgressMessage(todayMeals, dailyNorm)}`,
        {
          reply_markup: {
            keyboard: keyboardButtons,
            resize_keyboard: true,
            one_time_keyboard: false
          }
        }
      );
      return;
    }


    if (text === "🔙 Назад в меню") {
      // Получаем userId для создания ссылок на Mini App
      const { data: user } = await supabase
        .from("users")
        .select("id")
        .eq("telegram_id", telegram_id)
        .maybeSingle();

      const updateUrl = user ? `https://nutrition-app4.vercel.app/?id=${user.id}` : "";
      const statsUrl = user ? `https://nutrition-app4.vercel.app/stats?id=${user.id}` : "";

      const keyboardButtons: any[] = [
        [
          { text: "✏️ Обновить анкету", web_app: user ? { url: updateUrl } : undefined }
        ],
        [
          { text: "📋 Получить отчет", web_app: user ? { url: statsUrl } : undefined }
        ],
        [
          { text: "✏️ Редактировать прием пищи" }
        ],
        [
          { text: "💡 Рекомендации" }
        ]
      ];

      return ctx.reply("Главное меню:", {
        reply_markup: {
          keyboard: keyboardButtons,
          resize_keyboard: true,
          one_time_keyboard: false
        }
      });
    }

    if (text === "💡 Рекомендации") {
      const processingMsg = await ctx.reply("🤔 Анализирую ваше питание и готовлю рекомендации...");

      // Получаем данные пользователя
      const { data: userData } = await supabase
        .from("users")
        .select("calories, protein, fat, carbs, goal")
        .eq("telegram_id", telegram_id)
        .maybeSingle();

      if (!userData || !userData.calories) {
        await ctx.telegram.editMessageText(
          ctx.chat!.id,
          processingMsg.message_id,
          undefined,
          "❌ Сначала пройдите анкету, чтобы получить рекомендации."
        );
        return;
      }

      // Получаем все данные о питании за последние 30 дней для полного анализа
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      const monthAgoISO = monthAgo.toISOString();

      const { data: allMeals } = await supabase
        .from("diary")
        .select("calories, protein, fat, carbs, created_at")
        .eq("user_id", telegram_id)
        .gte("created_at", monthAgoISO)
        .order("created_at", { ascending: false });

      // Подсчитываем статистику
      const totals = (allMeals || []).reduce(
        (acc, meal) => ({
          calories: acc.calories + Number(meal.calories || 0),
          protein: acc.protein + Number(meal.protein || 0),
          fat: acc.fat + Number(meal.fat || 0),
          carbs: acc.carbs + Number(meal.carbs || 0)
        }),
        { calories: 0, protein: 0, fat: 0, carbs: 0 }
      );

      const daysWithMeals = new Set((allMeals || []).map(m => new Date(m.created_at).toDateString())).size;
      const avgDaily = daysWithMeals > 0 ? {
        calories: totals.calories / daysWithMeals,
        protein: totals.protein / daysWithMeals,
        fat: totals.fat / daysWithMeals,
        carbs: totals.carbs / daysWithMeals
      } : { calories: 0, protein: 0, fat: 0, carbs: 0 };

      // Получаем данные пользователя из анкеты
      const { data: userProfile } = await supabase
        .from("users")
        .select("gender, age, weight, height, activity, goal")
        .eq("telegram_id", telegram_id)
        .maybeSingle();

      const goalText = userData.goal === "lose" ? "похудение" : userData.goal === "gain" ? "набор веса" : "поддержание веса";
      const genderText = userProfile?.gender === "male" ? "мужчина" : "женщина";
      const activityText = userProfile?.activity === "low" ? "низкая" : 
                          userProfile?.activity === "moderate" ? "умеренная" :
                          userProfile?.activity === "high" ? "высокая" : "очень высокая";
      
      const prompt = `Ты — персональный тренер по питанию. Проанализируй данные пользователя и дай детальные рекомендации.

ДАННЫЕ ИЗ АНКЕТЫ:
- Пол: ${genderText}
- Возраст: ${userProfile?.age || "не указан"} лет
- Вес: ${userProfile?.weight || "не указан"} кг
- Рост: ${userProfile?.height || "не указан"} см
- Активность: ${activityText}
- Цель: ${goalText}

ДНЕВНАЯ НОРМА:
- Калории: ${userData.calories} ккал
- Белки: ${userData.protein}г
- Жиры: ${userData.fat}г
- Углеводы: ${userData.carbs}г

ФАКТИЧЕСКОЕ ПОТРЕБЛЕНИЕ (среднее за последние ${daysWithMeals} дней):
- Калории: ${avgDaily.calories.toFixed(0)} ккал/день (${((avgDaily.calories / userData.calories) * 100).toFixed(0)}% от нормы)
- Белки: ${avgDaily.protein.toFixed(1)}г/день (${((avgDaily.protein / userData.protein) * 100).toFixed(0)}% от нормы)
- Жиры: ${avgDaily.fat.toFixed(1)}г/день (${((avgDaily.fat / userData.fat) * 100).toFixed(0)}% от нормы)
- Углеводы: ${avgDaily.carbs.toFixed(1)}г/день (${((avgDaily.carbs / userData.carbs) * 100).toFixed(0)}% от нормы)

Дай детальный анализ:
1. Оценка текущего питания (что хорошо, что плохо)
2. Соответствие цели (насколько питание помогает достичь цели)
3. Конкретные рекомендации по калориям и БЖУ
4. Какие продукты добавить/убрать
5. Практические советы по улучшению питания
6. Мотивирующее заключение

Ответ должен быть на русском языке, структурированным, конкретным и мотивирующим.`;

      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "Ты — персональный тренер по питанию. Дай конкретные, полезные и мотивирующие рекомендации."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 800
        });

        const recommendations = response.choices[0]?.message?.content || "Не удалось сгенерировать рекомендации.";

        await ctx.telegram.editMessageText(
          ctx.chat!.id,
          processingMsg.message_id,
          undefined,
          `💡 Рекомендации по питанию:\n\n${recommendations}`
        );
      } catch (error) {
        console.error("[bot] Ошибка генерации рекомендаций:", error);
        await ctx.telegram.editMessageText(
          ctx.chat!.id,
          processingMsg.message_id,
          undefined,
          "❌ Не удалось сгенерировать рекомендации. Попробуйте позже."
        );
      }
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

    // Убеждаемся, что пользователь существует в таблице users
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_id", telegram_id)
      .maybeSingle();

    if (!existingUser) {
      // Создаём пользователя, если его нет
      const { data: newUser, error: createError } = await supabase
        .from("users")
        .upsert({ telegram_id }, { onConflict: "telegram_id", ignoreDuplicates: false })
        .select("id")
        .single();

      if (createError || !newUser) {
        console.error("[bot] Ошибка создания пользователя:", createError);
        await ctx.telegram.editMessageText(
          ctx.chat!.id,
          processingMsg.message_id,
          undefined,
          "❌ Ошибка: пользователь не найден. Используйте /start для регистрации."
        );
        return;
      }
    }

    // Сохраняем в базу
    const { error: insertError } = await supabase.from("diary").insert({
      user_id: telegram_id,
      meal_text: analysis.description,
      calories: analysis.calories,
      protein: analysis.protein,
      fat: analysis.fat,
      carbs: analysis.carbs
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
      .from("diary")
      .select("id, meal_text, calories")
      .eq("user_id", telegram_id)
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
      .from("diary")
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
      `✅ Удалено: ${lastMeal.meal_text} (${lastMeal.calories} ккал)\n\n${formatProgressMessage(todayMeals, dailyNorm)}`
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
      .from("diary")
      .select("meal_text, calories, protein, fat, carbs, created_at")
      .eq("user_id", telegram_id)
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
      report += `${index + 1}. ${meal.meal_text} (${time})\n   🔥 ${meal.calories} ккал | 🥚 ${Number(meal.protein).toFixed(1)}г | 🥥 ${Number(meal.fat).toFixed(1)}г | 🍚 ${Number(meal.carbs || 0).toFixed(1)}г\n\n`;
    });

    report += `\n${formatProgressMessage(todayMeals, dailyNorm)}`;

    ctx.reply(report);
  } catch (error) {
    console.error("[bot] Ошибка /отчет:", error);
    ctx.reply("Произошла ошибка.");
  }
});

// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
//      Обработка фото
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

/**
 * Анализирует фото еды через OpenAI GPT-4o Vision
 */
async function analyzePhotoWithOpenAI(photoUrl: string): Promise<MealAnalysis | null> {
  try {
    console.log(`[OpenAI] Начинаю анализ фото: ${photoUrl.substring(0, 50)}...`);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Ты — помощник по анализу питания. Всегда возвращай валидный JSON без дополнительного текста."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Ты — эксперт по питанию. Проанализируй фото еды и верни ТОЛЬКО JSON в следующем формате:
{
  "description": "краткое название блюда на русском",
  "calories": число (ккал),
  "protein": число (граммы),
  "fat": число (граммы),
  "carbs": число (граммы)
}

Оцени количество еды на фото и определи примерную калорийность и макроэлементы. Будь точным, но если точных данных нет — используй средние значения для подобных блюд.`
            },
            {
              type: "image_url",
              image_url: {
                url: photoUrl
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 500
    });

    console.log("[OpenAI] Получен ответ от OpenAI Vision");
    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error("[OpenAI] Пустой ответ от OpenAI Vision");
      return null;
    }

    console.log(`[OpenAI] Содержимое ответа: ${content.substring(0, 200)}...`);
    
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error("[OpenAI] Ошибка парсинга JSON:", parseError);
      console.error("[OpenAI] Сырой ответ:", content);
      return null;
    }

    const result = {
      description: parsed.description || "Еда на фото",
      calories: Number(parsed.calories) || 0,
      protein: Number(parsed.protein) || 0,
      fat: Number(parsed.fat) || 0,
      carbs: Number(parsed.carbs) || 0
    };

    console.log(`[OpenAI] Успешно проанализировано фото:`, result);
    return result;
  } catch (error: any) {
    console.error("[OpenAI] Ошибка анализа фото:", error);
    if (error?.message) {
      console.error("[OpenAI] Детали ошибки:", error.message);
    }
    return null;
  }
}

bot.on("photo", async (ctx) => {
  try {
    const telegram_id = ctx.from?.id;
    if (!telegram_id) {
      return ctx.reply("Ошибка: не удалось определить ваш Telegram ID");
    }

    console.log(`[bot] Получено фото от ${telegram_id}`);

    // Показываем, что обрабатываем
    const processingMsg = await ctx.reply("📸 Анализирую фото еды...");

    // Получаем фото в лучшем качестве
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const file = await ctx.telegram.getFile(photo.file_id);
    const photoUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

    console.log(`[bot] URL фото: ${photoUrl}`);

    // Анализируем через OpenAI Vision
    const analysis = await analyzePhotoWithOpenAI(photoUrl);
    if (!analysis) {
      await ctx.telegram.editMessageText(
        ctx.chat!.id,
        processingMsg.message_id,
        undefined,
        "❌ Не удалось проанализировать фото. Попробуйте отправить более чёткое фото еды."
      );
      return;
    }

    // Убеждаемся, что пользователь существует
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_id", telegram_id)
      .maybeSingle();

    if (!existingUser) {
      const { data: newUser, error: createError } = await supabase
        .from("users")
        .upsert({ telegram_id }, { onConflict: "telegram_id", ignoreDuplicates: false })
        .select("id")
        .single();

      if (createError || !newUser) {
        console.error("[bot] Ошибка создания пользователя:", createError);
        await ctx.telegram.editMessageText(
          ctx.chat!.id,
          processingMsg.message_id,
          undefined,
          "❌ Ошибка: пользователь не найден. Используйте /start для регистрации."
        );
        return;
      }
    }

    // Сохраняем в базу
    const { error: insertError } = await supabase.from("diary").insert({
      user_id: telegram_id,
      meal_text: analysis.description,
      calories: analysis.calories,
      protein: analysis.protein,
      fat: analysis.fat,
      carbs: analysis.carbs
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
    console.error("[bot] Ошибка обработки фото:", error);
    ctx.reply("Произошла ошибка при обработке фото.");
  }
});

// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
//      Обработка аудио
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

/**
 * Транскрибирует аудио через OpenAI Whisper
 */
async function transcribeAudio(audioUrl: string): Promise<string | null> {
  try {
    console.log(`[OpenAI] Начинаю транскрипцию аудио: ${audioUrl.substring(0, 50)}...`);
    
    // Скачиваем аудио файл
    const response = await fetch(audioUrl);
    if (!response.ok) {
      console.error("[OpenAI] Ошибка загрузки аудио:", response.statusText);
      return null;
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    
    // OpenAI SDK принимает File, Blob или Buffer
    // Создаём File-like объект из Buffer
    const audioFile = new File([audioBuffer], "audio.ogg", { type: "audio/ogg" });

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "ru"
    });

    const text = transcription.text.trim();
    console.log(`[OpenAI] Транскрибировано: "${text}"`);
    return text;
  } catch (error: any) {
    console.error("[OpenAI] Ошибка транскрипции:", error);
    if (error?.message) {
      console.error("[OpenAI] Детали ошибки:", error.message);
    }
    return null;
  }
}

bot.on("voice", async (ctx) => {
  try {
    const telegram_id = ctx.from?.id;
    if (!telegram_id) {
      return ctx.reply("Ошибка: не удалось определить ваш Telegram ID");
    }

    console.log(`[bot] Получено голосовое сообщение от ${telegram_id}`);

    // Показываем, что обрабатываем
    const processingMsg = await ctx.reply("🎤 Расшифровываю голосовое сообщение...");

    // Получаем аудио файл
    const voice = ctx.message.voice;
    const file = await ctx.telegram.getFile(voice.file_id);
    const audioUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

    console.log(`[bot] URL аудио: ${audioUrl}`);

    // Транскрибируем через Whisper
    const transcribedText = await transcribeAudio(audioUrl);
    if (!transcribedText) {
      await ctx.telegram.editMessageText(
        ctx.chat!.id,
        processingMsg.message_id,
        undefined,
        "❌ Не удалось расшифровать голосовое сообщение. Попробуйте ещё раз."
      );
      return;
    }

    // Обновляем сообщение
    await ctx.telegram.editMessageText(
      ctx.chat!.id,
      processingMsg.message_id,
      undefined,
      `🔍 Расшифровано: "${transcribedText}"\n\nАнализирую еду...`
    );

    // Анализируем текст через OpenAI
    const analysis = await analyzeFoodWithOpenAI(transcribedText);
    if (!analysis) {
      await ctx.telegram.editMessageText(
        ctx.chat!.id,
        processingMsg.message_id,
        undefined,
        "❌ Не удалось проанализировать описание еды. Попробуйте описать подробнее."
      );
      return;
    }

    // Убеждаемся, что пользователь существует
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_id", telegram_id)
      .maybeSingle();

    if (!existingUser) {
      const { data: newUser, error: createError } = await supabase
        .from("users")
        .upsert({ telegram_id }, { onConflict: "telegram_id", ignoreDuplicates: false })
        .select("id")
        .single();

      if (createError || !newUser) {
        console.error("[bot] Ошибка создания пользователя:", createError);
        await ctx.telegram.editMessageText(
          ctx.chat!.id,
          processingMsg.message_id,
          undefined,
          "❌ Ошибка: пользователь не найден. Используйте /start для регистрации."
        );
        return;
      }
    }

    // Сохраняем в базу
    const { error: insertError } = await supabase.from("diary").insert({
      user_id: telegram_id,
      meal_text: analysis.description,
      calories: analysis.calories,
      protein: analysis.protein,
      fat: analysis.fat,
      carbs: analysis.carbs
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
    console.error("[bot] Ошибка обработки аудио:", error);
    ctx.reply("Произошла ошибка при обработке голосового сообщения.");
  }
});
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
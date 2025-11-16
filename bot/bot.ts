import 'dotenv/config'
import { Telegraf } from "telegraf";
import { createClient } from "@supabase/supabase-js";

const token = process.env.TELEGRAM_BOT_TOKEN;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN не задан в переменных окружения.");
}

if (!supabaseUrl || !supabaseKey) {
  throw new Error("SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY не заданы.");
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const bot = new Telegraf(token);

bot.start(async (ctx) => {
  await ctx.reply("Бот подключён ✔️");

  const { error } = await supabase.from("users_test").insert({});

  if (error) {
    console.error("Не удалось записать старт в таблицу users_test", error);
  }
});

bot.launch().then(() => {
  console.log("Telegram bot запущен");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
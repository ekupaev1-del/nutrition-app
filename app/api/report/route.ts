import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");

  if (!userId || !start || !end) {
    return NextResponse.json(
      { ok: false, error: "userId, start и end обязательны" },
      { status: 400 }
    );
  }

  const numericId = Number(userId);
  if (!Number.isFinite(numericId)) {
    return NextResponse.json({ ok: false, error: "userId должен быть числом" }, { status: 400 });
  }

  // Получаем telegram_id из users
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("telegram_id")
    .eq("id", numericId)
    .maybeSingle();

  if (userError || !user) {
    return NextResponse.json({ ok: false, error: "Пользователь не найден" }, { status: 404 });
  }

  // Получаем приемы пищи за период
  // Расширяем диапазон на ±12 часов для покрытия всех часовых поясов
  const startDate = new Date(start);
  startDate.setUTCHours(startDate.getUTCHours() - 12, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setUTCHours(endDate.getUTCHours() + 12, 59, 59, 999);
  
  const { data: meals, error } = await supabase
    .from("diary")
    .select("*")
    .eq("user_id", user.telegram_id)
    .gte("created_at", startDate.toISOString())
    .lte("created_at", endDate.toISOString())
    .order("created_at", { ascending: true });

  console.log("[/api/report] Запрос:", {
    user_id: user.telegram_id,
    start_original: start,
    end_original: end,
    start_expanded: startDate.toISOString(),
    end_expanded: endDate.toISOString(),
    found_meals: meals?.length || 0,
    meal_dates: meals?.slice(0, 5).map(m => m.created_at) || []
  });

  if (error) {
    console.error("[/api/report] Ошибка:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Подсчитываем итоги
  const totals = (meals || []).reduce(
    (acc, meal) => ({
      calories: acc.calories + Number(meal.calories || 0),
      protein: acc.protein + Number(meal.protein || 0),
      fat: acc.fat + Number(meal.fat || 0),
      carbs: acc.carbs + Number(meal.carbs || 0)
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );

  return NextResponse.json({ ok: true, meals: meals || [], totals });
}


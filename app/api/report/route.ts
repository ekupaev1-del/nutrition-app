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

  // start и end приходят в формате ISO строки (локальное время пользователя, конвертированное в UTC)
  // Просто используем их для запроса - Supabase работает с UTC
  const startDate = new Date(start);
  const endDate = new Date(end);
  
  // Расширяем диапазон на 1 день в обе стороны для надежности
  startDate.setUTCDate(startDate.getUTCDate() - 1);
  startDate.setUTCHours(0, 0, 0, 0);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  endDate.setUTCHours(23, 59, 59, 999);
  
  // Получаем ВСЕ записи за расширенный период - фильтрация будет на клиенте
  const { data: meals, error } = await supabase
    .from("diary")
    .select("*")
    .eq("user_id", user.telegram_id)
    .gte("created_at", startDate.toISOString())
    .lte("created_at", endDate.toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[/api/report] Ошибка:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Возвращаем все данные - фильтрация по локальному времени будет на клиенте
  return NextResponse.json({ ok: true, meals: meals || [] });
}

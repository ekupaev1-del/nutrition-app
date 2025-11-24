import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

/**
 * API для получения отчётов о питании
 * 
 * Параметры:
 * - userId: ID пользователя (из таблицы users)
 * - start: начало периода в ISO формате (UTC)
 * - end: конец периода в ISO формате (UTC)
 * 
 * Возвращает все записи за указанный период, отсортированные по дате (новые сначала)
 */
export async function GET(req: Request) {
  try {
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
    if (!Number.isFinite(numericId) || numericId <= 0) {
      return NextResponse.json(
        { ok: false, error: "userId должен быть положительным числом" },
        { status: 400 }
      );
    }

    // Получаем telegram_id из users
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("telegram_id")
      .eq("id", numericId)
      .maybeSingle();

    if (userError) {
      console.error("[/api/report] Ошибка получения пользователя:", userError);
      return NextResponse.json(
        { ok: false, error: "Ошибка базы данных" },
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Пользователь не найден" },
        { status: 404 }
      );
    }

    // Парсим даты
    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { ok: false, error: "Некорректный формат даты" },
        { status: 400 }
      );
    }

    // Убеждаемся, что start <= end
    if (startDate > endDate) {
      return NextResponse.json(
        { ok: false, error: "Начало периода должно быть раньше конца" },
        { status: 400 }
      );
    }

    // Устанавливаем точные границы времени для фильтрации
    // startDate: начало дня (00:00:00.000)
    // endDate: конец дня (23:59:59.999)
    const startUTC = new Date(startDate);
    startUTC.setUTCHours(0, 0, 0, 0);
    
    const endUTC = new Date(endDate);
    endUTC.setUTCHours(23, 59, 59, 999);

    // Получаем все записи за период
    // Фильтруем по user_id (telegram_id) и created_at
    const { data: meals, error: mealsError } = await supabase
      .from("diary")
      .select("*")
      .eq("user_id", user.telegram_id)
      .gte("created_at", startUTC.toISOString())
      .lte("created_at", endUTC.toISOString())
      .order("created_at", { ascending: false }); // Новые сначала

    if (mealsError) {
      console.error("[/api/report] Ошибка получения записей:", mealsError);
      return NextResponse.json(
        { ok: false, error: "Ошибка получения данных" },
        { status: 500 }
      );
    }

    // Возвращаем данные
    return NextResponse.json({
      ok: true,
      meals: meals || [],
      count: meals?.length || 0
    });
  } catch (error: any) {
    console.error("[/api/report] Неожиданная ошибка:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}

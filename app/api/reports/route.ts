import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

/**
 * GET /api/reports
 * 
 * Параметры:
 * - userId: ID пользователя (из таблицы users)
 * - start: начало периода в ISO формате (UTC)
 * - end: конец периода в ISO формате (UTC)
 * 
 * Возвращает:
 * - meals: массив приёмов пищи за период
 * - dailyNorm: дневная норма калорий пользователя
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

    // Получаем пользователя и его дневную норму
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("telegram_id, calories")
      .eq("id", numericId)
      .maybeSingle();

    if (userError) {
      console.error("[/api/reports] Ошибка получения пользователя:", userError);
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

    // Валидация дат
    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { ok: false, error: "Некорректный формат даты" },
        { status: 400 }
      );
    }

    if (startDate > endDate) {
      return NextResponse.json(
        { ok: false, error: "Начало периода должно быть раньше конца" },
        { status: 400 }
      );
    }

    // Получаем все записи за период
    // Используем даты как есть (они уже в UTC от клиента)
    const { data: meals, error: mealsError } = await supabase
      .from("diary")
      .select("*")
      .eq("user_id", user.telegram_id)
      .gte("created_at", start)
      .lte("created_at", end)
      .order("created_at", { ascending: false }); // Новые сначала

    if (mealsError) {
      console.error("[/api/reports] Ошибка получения записей:", mealsError);
      return NextResponse.json(
        { ok: false, error: "Ошибка получения данных" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      meals: meals || [],
      dailyNorm: user.calories || null
    });
  } catch (error: any) {
    console.error("[/api/reports] Неожиданная ошибка:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}


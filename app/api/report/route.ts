import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

/**
 * GET /api/report
 * 
 * Универсальный эндпоинт для получения отчётов.
 * ВСЯ логика формирования отчёта происходит на бэкенде.
 * 
 * Параметры:
 * - userId: ID пользователя (из таблицы users)
 * - periodStart: начало периода в формате YYYY-MM-DD (локальное время пользователя)
 * - periodEnd: конец периода в формате YYYY-MM-DD (локальное время пользователя)
 * 
 * Возвращает готовый отчёт с:
 * - meals: массив приёмов пищи, сгруппированных по дням
 * - totals: итоговые значения калорий, БЖУ за период
 * - dailyNorm: дневная норма калорий пользователя
 * - periodNorm: норма калорий за весь период
 * - periodDays: количество дней в периоде
 */
export async function GET(req: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    const periodStart = url.searchParams.get("periodStart");
    const periodEnd = url.searchParams.get("periodEnd");

    if (!userId || !periodStart || !periodEnd) {
      return NextResponse.json(
        { ok: false, error: "userId, periodStart и periodEnd обязательны" },
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
      .select("telegram_id, calories, protein, fat, carbs")
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

    // Парсим даты периода (локальное время пользователя)
    const startDate = new Date(periodStart + "T00:00:00");
    const endDate = new Date(periodEnd + "T23:59:59.999");

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

    // Конвертируем локальные даты в UTC для запроса к БД
    const startUTC = new Date(startDate);
    startUTC.setUTCHours(0, 0, 0, 0);
    
    const endUTC = new Date(endDate);
    endUTC.setUTCHours(23, 59, 59, 999);

    // Получаем все записи за период из БД
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

    // ВСЯ ЛОГИКА ФОРМИРОВАНИЯ ОТЧЁТА НА БЭКЕНДЕ

    // 1. Вычисляем количество дней в периоде
    const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // 2. Вычисляем итоговые значения за период
    const totals = (meals || []).reduce(
      (acc, meal) => ({
        calories: acc.calories + Number(meal.calories || 0),
        protein: acc.protein + Number(meal.protein || 0),
        fat: acc.fat + Number(meal.fat || 0),
        carbs: acc.carbs + Number(meal.carbs || 0)
      }),
      { calories: 0, protein: 0, fat: 0, carbs: 0 }
    );

    // 3. Вычисляем норму за период
    const dailyNorm = user.calories || 0;
    const periodNorm = dailyNorm * periodDays;

    // 4. Группируем приёмы пищи по дням (новые дни сверху)
    const mealsByDay: Record<string, typeof meals> = {};
    
    (meals || []).forEach(meal => {
      // Конвертируем UTC из БД в локальное время для группировки
      const mealDate = new Date(meal.created_at);
      const dayKey = mealDate.toISOString().split("T")[0]; // YYYY-MM-DD
      
      if (!mealsByDay[dayKey]) {
        mealsByDay[dayKey] = [];
      }
      mealsByDay[dayKey].push(meal);
    });

    // 5. Преобразуем в массив дней, отсортированный по дате (новые сверху)
    const days = Object.keys(mealsByDay)
      .sort((a, b) => b.localeCompare(a)) // Новые дни сверху
      .map(dayKey => ({
        date: dayKey,
        meals: mealsByDay[dayKey]
      }));

    // 6. Вычисляем процент от нормы
    const percentage = periodNorm > 0 ? (totals.calories / periodNorm) * 100 : 0;

    // Возвращаем готовый отчёт
    return NextResponse.json({
      ok: true,
      report: {
        mealsByDay: days,
        totals,
        dailyNorm,
        periodNorm,
        periodDays,
        percentage: Math.round(percentage * 10) / 10, // Округляем до 1 знака
        mealsCount: meals?.length || 0
      }
    });
  } catch (error: any) {
    console.error("[/api/report] Неожиданная ошибка:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}


import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * OPTIONS handler for CORS
 */
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * GET /api/report/calendar
 * 
 * Календарь: возвращает массив дат, в которых есть записи
 * 
 * Параметры:
 * - userId: ID пользователя (из таблицы users)
 * - month: месяц в формате YYYY-MM (например, 2024-01)
 * 
 * Возвращает:
 * - dates: массив дат в формате YYYY-MM-DD, в которых есть записи
 */
export async function GET(req: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    const month = url.searchParams.get("month");

    if (!userId || !month) {
      return NextResponse.json(
        { ok: false, error: "userId и month обязательны" },
        { status: 400 }
      );
    }

    const numericId = Number(userId);
    if (!Number.isFinite(numericId) || numericId <= 0) {
      return NextResponse.json(
        { ok: false, error: "userId должен быть положительным числом" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Получаем пользователя и его дневную норму
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("telegram_id, calories")
      .eq("id", numericId)
      .maybeSingle();

    if (userError) {
      console.error("[/api/report/calendar] Ошибка получения пользователя:", userError);
      return NextResponse.json(
        { ok: false, error: "Ошибка базы данных" },
        { status: 500, headers: corsHeaders }
      );
    }

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Пользователь не найден" },
        { status: 404, headers: corsHeaders }
      );
    }

    const dailyNorm = user.calories || 0;
    
    // КРИТИЧНО: Проверяем что норма есть
    if (dailyNorm === 0) {
      console.warn("[/api/report/calendar] ⚠️ ВНИМАНИЕ: dailyNorm = 0! Проценты будут 0%");
    } else {
      console.log("[/api/report/calendar] ✅ Дневная норма:", dailyNorm, "ккал");
    }

    // Парсим месяц и вычисляем границы
    const monthStart = new Date(month + "-01T00:00:00");
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    monthEnd.setDate(0); // Последний день месяца
    monthEnd.setHours(23, 59, 59, 999);

    if (isNaN(monthStart.getTime()) || isNaN(monthEnd.getTime())) {
      return NextResponse.json(
        { ok: false, error: "Некорректный формат месяца" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Конвертируем в UTC для запроса к БД
    const startUTC = monthStart.toISOString();
    const endUTC = monthEnd.toISOString();

    // Получаем все записи за месяц из БД
    console.log("[/api/report/calendar] Запрос к БД:", {
      userId: user.telegram_id,
      month,
      startUTC,
      endUTC
    });

    const { data: meals, error: mealsError } = await supabase
      .from("diary")
      .select("created_at, calories")
      .eq("user_id", user.telegram_id)
      .gte("created_at", startUTC)
      .lte("created_at", endUTC);

    if (mealsError) {
      console.error("[/api/report/calendar] Ошибка получения записей:", mealsError);
      return NextResponse.json(
        { ok: false, error: "Ошибка получения данных" },
        { status: 500, headers: corsHeaders }
      );
    }

    console.log("[/api/report/calendar] Получено записей из БД:", meals?.length || 0);
    console.log("[/api/report/calendar] Дневная норма:", dailyNorm);
    console.log("[/api/report/calendar] Первые 3 записи:", meals?.slice(0, 3).map(m => ({
      created_at: m.created_at,
      calories: m.calories,
      dateKey: new Date(m.created_at).toISOString().split("T")[0]
    })));

    // Группируем записи по датам и считаем калории за каждый день
    const dayDataMap = new Map<string, number>();
    
    (meals || []).forEach(meal => {
      const mealDate = new Date(meal.created_at);
      const dayKey = mealDate.toISOString().split("T")[0]; // YYYY-MM-DD
      const currentCalories = dayDataMap.get(dayKey) || 0;
      const mealCalories = Number(meal.calories || 0);
      dayDataMap.set(dayKey, currentCalories + mealCalories);
      
      // Отладка для 6 декабря
      if (dayKey === '2025-12-06') {
        console.log(`[/api/report/calendar] 🔴 6 декабря: добавляем ${mealCalories} ккал, всего: ${currentCalories + mealCalories}`);
      }
    });
    
    console.log("[/api/report/calendar] dayDataMap размер:", dayDataMap.size);
    console.log("[/api/report/calendar] dayDataMap содержимое:", Array.from(dayDataMap.entries()));

    // Создаём массив объектов с датами и процентами
    const datesWithPercentage = Array.from(dayDataMap.entries())
      .map(([date, totalCalories]) => {
        const percentage = dailyNorm > 0 ? (totalCalories / dailyNorm) * 100 : 0;
        const roundedPercentage = Math.round(percentage * 10) / 10;
        
        // Отладка: логируем расчет процента
        if (roundedPercentage > 110) {
          console.log(`[/api/report/calendar] День ${date}: ${totalCalories} ккал / ${dailyNorm} ккал = ${roundedPercentage}%`);
        }
        
        return {
          date,
          percentage: roundedPercentage
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    // Для обратной совместимости также возвращаем массив дат
    const dates = datesWithPercentage.map(item => item.date);
    
    console.log("[/api/report/calendar] Возвращаем даты с процентами:", { 
      datesCount: dates.length,
      dailyNorm: dailyNorm,
      datesWithPercentage: datesWithPercentage.slice(0, 10) // Показываем первые 10 для логов
    });

    // КРИТИЧНО: Проверяем что данные есть перед возвратом
    console.log("[/api/report/calendar] 🔍 ПЕРЕД возвратом:", {
      datesCount: dates.length,
      datesWithPercentageCount: datesWithPercentage.length,
      datesWithPercentage: datesWithPercentage,
      dailyNorm: dailyNorm
    });
    
    // Возвращаем массив дат и данные с процентами
    const responseData = {
      ok: true,
      dates, // Для обратной совместимости
      datesWithPercentage // Новые данные с процентами
    };
    
    console.log("[/api/report/calendar] ✅ Возвращаем данные:", {
      hasDates: !!responseData.dates,
      hasDatesWithPercentage: !!responseData.datesWithPercentage,
      datesWithPercentageLength: responseData.datesWithPercentage?.length || 0,
      datesWithPercentage: responseData.datesWithPercentage
    });
    
    // КРИТИЧНО: Проверяем что datesWithPercentage не пустой
    if (responseData.datesWithPercentage.length === 0 && responseData.dates.length > 0) {
      console.error("[/api/report/calendar] ❌ ОШИБКА: datesWithPercentage пустой, но dates есть!");
      console.error("[/api/report/calendar] dayDataMap:", Array.from(dayDataMap.entries()));
      console.error("[/api/report/calendar] dailyNorm:", dailyNorm);
    }
    
    return NextResponse.json(responseData, { headers: corsHeaders });
  } catch (error: any) {
    console.error("[/api/report/calendar] Неожиданная ошибка:", error);
      return NextResponse.json(
        { ok: false, error: error.message || "Внутренняя ошибка сервера" },
        { status: 500, headers: corsHeaders }
      );
  }
}


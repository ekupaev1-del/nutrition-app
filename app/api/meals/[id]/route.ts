import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const mealId = Number(params.id);
  if (!Number.isFinite(mealId)) {
    return NextResponse.json({ ok: false, error: "ID должен быть числом" }, { status: 400 });
  }

  const body = await req.json();
  const { meal_text, calories, protein, fat, carbs } = body;

  const { data, error } = await supabase
    .from("diary")
    .update({
      meal_text,
      calories: Number(calories) || 0,
      protein: Number(protein) || 0,
      fat: Number(fat) || 0,
      carbs: Number(carbs) || 0
    })
    .eq("id", mealId)
    .select("id")
    .single();

  if (error) {
    console.error("[/api/meals/:id] Ошибка обновления:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ ok: false, error: "Прием пищи не найден" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, id: data.id });
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const mealId = Number(params.id);
    console.log("[/api/meals/:id DELETE] Получен запрос на удаление, mealId:", mealId);
    
    if (!Number.isFinite(mealId) || mealId <= 0) {
      console.error("[/api/meals/:id DELETE] Некорректный ID:", params.id);
      return NextResponse.json({ ok: false, error: "ID должен быть положительным числом" }, { status: 400 });
    }

    // Проверяем, существует ли запись перед удалением
    const { data: existingMeal, error: selectError } = await supabase
      .from("diary")
      .select("id")
      .eq("id", mealId)
      .maybeSingle();

    if (selectError) {
      console.error("[/api/meals/:id DELETE] Ошибка проверки записи:", selectError);
      return NextResponse.json({ ok: false, error: selectError.message }, { status: 500 });
    }

    if (!existingMeal) {
      console.warn("[/api/meals/:id DELETE] Запись не найдена, mealId:", mealId);
      return NextResponse.json({ ok: false, error: "Прием пищи не найден" }, { status: 404 });
    }

    // Удаляем запись
    const { error, count } = await supabase
      .from("diary")
      .delete()
      .eq("id", mealId)
      .select();

    if (error) {
      console.error("[/api/meals/:id DELETE] Ошибка удаления:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    console.log("[/api/meals/:id DELETE] Успешно удалено, mealId:", mealId);
    return NextResponse.json({ ok: true, deleted: true });
  } catch (err: any) {
    console.error("[/api/meals/:id DELETE] Неожиданная ошибка:", err);
    return NextResponse.json({ ok: false, error: err.message || "Ошибка удаления" }, { status: 500 });
  }
}


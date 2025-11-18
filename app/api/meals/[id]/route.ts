import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const mealId = Number(params.id);
  if (!Number.isFinite(mealId)) {
    return NextResponse.json({ ok: false, error: "ID должен быть числом" }, { status: 400 });
  }

  const { error } = await supabase.from("diary").delete().eq("id", mealId);

  if (error) {
    console.error("[/api/meals/:id] Ошибка удаления:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}


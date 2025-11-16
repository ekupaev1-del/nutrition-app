import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const url = new URL(req.url);
  const userId = url.searchParams.get("id");

  if (!userId) {
    console.error("[/api/save] Нет id в URL");
    return NextResponse.json(
      { ok: false, error: "ID отсутствует в URL" },
      { status: 400 }
    );
  }

  const numericId = Number(userId);
  if (!Number.isFinite(numericId)) {
    console.error("[/api/save] Некорректный id (не число):", userId);
    return NextResponse.json(
      { ok: false, error: "ID должен быть числом" },
      { status: 400 }
    );
  }

  const body = await req.json();
  const {
    gender,
    age,
    weight,
    height,
    activity,
    goal,
    calories,
    protein,
    fat,
    carbs
  } = body;

  console.log("[/api/save] UPDATE users by id:", numericId, {
    gender,
    age,
    weight,
    height,
    activity,
    goal,
    calories,
    protein,
    fat,
    carbs
  });

  // ВАЖНО: Только UPDATE, никаких INSERT/UPSERT!
  // Форма НИКОГДА не должна создавать новые строки в users.
  // Бот создаёт строку при /start, форма только обновляет существующую.
  const { data, error } = await supabase
    .from("users")
    .update({
      gender,
      age,
      weight,
      height,
      activity,
      goal,
      calories,
      protein,
      fat,
      carbs
    })
    .eq("id", numericId)
    .select("id");

  if (error) {
    console.error("[/api/save] supabase error:", error);
    // Если ошибка связана с telegram_id - это значит кто-то пытается создать строку
    // Этого не должно происходить, так как мы делаем только UPDATE
    if (error.message?.includes("telegram_id")) {
      console.error("[/api/save] КРИТИЧЕСКАЯ ОШИБКА: Попытка создать строку без telegram_id!");
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (!data || data.length === 0) {
    console.error("[/api/save] Не найден пользователь с id:", numericId);
    // НИ В КОЕМ СЛУЧАЕ не создаём новую строку!
    return NextResponse.json(
      { ok: false, error: "Пользователь с таким id не найден. Запустите /start в боте" },
      { status: 404 }
    );
  }

  console.log("[/api/save] OK updated id:", numericId);
  return NextResponse.json({ ok: true, id: data[0].id });
}

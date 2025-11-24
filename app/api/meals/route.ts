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

  if (!userId) {
    return NextResponse.json({ ok: false, error: "userId отсутствует" }, { status: 400 });
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

  // Получаем все приемы пищи пользователя
  const { data: meals, error } = await supabase
    .from("diary")
    .select("*")
    .eq("user_id", user.telegram_id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[/api/meals] Ошибка:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  console.log("[/api/meals] Запрос для user_id:", user.telegram_id, "найдено записей:", meals?.length || 0);
  console.log("[/api/meals] Первые 3 записи:", meals?.slice(0, 3).map(m => ({ id: m.id, text: m.meal_text, created_at: m.created_at })) || []);

  return NextResponse.json({ ok: true, meals: meals || [] });
}


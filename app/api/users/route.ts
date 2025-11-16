import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseAdmin";

type UsersInsertBody = {
  gender: "male" | "female";
  age: number;
  height: number;
  weight: number;
  activity: "sedentary" | "light" | "moderate" | "active" | "very_active";
  goal: "lose" | "gain" | "maintain";
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
};

const validateBody = (body: Partial<UsersInsertBody>): body is UsersInsertBody => {
  if (!body.gender || !body.goal || !body.activity) {
    return false;
  }

  const numberFields: (keyof UsersInsertBody)[] = [
    "age",
    "height",
    "weight",
    "calories",
    "protein",
    "fat",
    "carbs"
  ];
  return numberFields.every((field) => {
    const value = body[field];
    return typeof value === "number" && Number.isFinite(value) && value > 0;
  });
};

export async function POST(request: Request) {
  let payload: Partial<UsersInsertBody>;
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json({ message: "Не удалось прочитать данные запроса." }, { status: 400 });
  }

  if (!validateBody(payload)) {
    return NextResponse.json({ message: "Проверь введённые данные и попробуй снова." }, { status: 422 });
  }

  let supabase;
  try {
    supabase = createServerSupabaseClient();
  } catch (error) {
    return NextResponse.json(
      { message: "Supabase не настроен. Добавь переменные окружения и перезапусти приложение." },
      { status: 500 }
    );
  }

  const { error } = await supabase
    .from("users")
    .insert({
      gender: payload.gender,
      age: payload.age,
      height: payload.height,
      weight: payload.weight,
      activity: payload.activity,
      goal: payload.goal,
      calories: payload.calories,
      protein: payload.protein,
      fat: payload.fat,
      carbs: payload.carbs,
      created_at: new Date().toISOString()
    });

  if (error) {
    console.error("Supabase insert error", error);
    return NextResponse.json(
      { message: `Не удалось сохранить данные в Supabase: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ message: "Сохранили результаты" });
}

"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function Page() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("id"); // <-- вот отсюда берём id

  const [gender, setGender] = useState<string | null>(null);
  const [age, setAge] = useState<number | null>(null);
  const [weight, setWeight] = useState<number | null>(null);
  const [height, setHeight] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId) {
      alert("Нет id пользователя в ссылке");
      return;
    }

    const numericId = Number(userId);
    if (!Number.isFinite(numericId)) {
      alert("Некорректный id пользователя");
      return;
    }

    const res = await fetch(`/api/save?id=${numericId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        gender,
        age,
        weight,
        height,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(`Ошибка сохранения: ${data?.error ?? res.statusText}`);
      return;
    }

    alert("Сохранено!");
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* тут твои поля формы: пол, возраст и т.д. */}
      <button type="submit">Сохранить</button>
    </form>
  );
}
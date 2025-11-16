"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import "./globals.css";

// Клиентский компонент с формой
export function QuestionnaireFormContent() {
  const searchParams = useSearchParams();
  const userIdParam = searchParams.get("id");

  const [userId, setUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Форма данные
  const [gender, setGender] = useState<string>("");
  const [age, setAge] = useState<string>("");
  const [weight, setWeight] = useState<string>("");
  const [height, setHeight] = useState<string>("");
  const [activity, setActivity] = useState<string>("");
  const [goal, setGoal] = useState<string>("");
  const [calories, setCalories] = useState<number | null>(null);
  const [protein, setProtein] = useState<number | null>(null);
  const [fat, setFat] = useState<number | null>(null);
  const [carbs, setCarbs] = useState<number | null>(null);

  // Проверяем id при монтировании
  useEffect(() => {
    if (userIdParam) {
      const n = Number(userIdParam);
      if (Number.isFinite(n) && n > 0) {
        setUserId(n);
        setError(null);
      } else {
        setError("Некорректный id пользователя");
      }
    } else {
      setError("ID не передан. Запустите анкету через Telegram бота");
    }
  }, [userIdParam]);

  const calculateMacros = useCallback(() => {
    if (!gender || !age || !weight || !height || !activity || !goal) return;

    const ageNum = Number(age);
    const weightNum = Number(weight);
    const heightNum = Number(height);

    if (!Number.isFinite(ageNum) || !Number.isFinite(weightNum) || !Number.isFinite(heightNum)) {
      return;
    }

    // Формула Миффлина-Сан Жеора
    let bmr = 0;
    if (gender === "male") {
      bmr = 10 * weightNum + 6.25 * heightNum - 5 * ageNum + 5;
    } else {
      bmr = 10 * weightNum + 6.25 * heightNum - 5 * ageNum - 161;
    }

    // Коэффициент активности
    const activityMultipliers: Record<string, number> = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very_active: 1.9
    };

    const multiplier = activityMultipliers[activity] || 1.2;
    let totalCalories = bmr * multiplier;

    // Корректировка по цели
    const goalMultipliers: Record<string, number> = {
      lose: 0.85,
      maintain: 1.0,
      gain: 1.15
    };

    const goalMultiplier = goalMultipliers[goal] || 1.0;
    totalCalories = Math.round(totalCalories * goalMultiplier);

    // Макроэлементы (стандартное распределение)
    const proteinGrams = Math.round(weightNum * 2.2); // 2.2г белка на кг веса
    const proteinCalories = proteinGrams * 4;

    const fatCalories = Math.round(totalCalories * 0.25); // 25% от калорий
    const fatGrams = Math.round(fatCalories / 9);

    const carbsCalories = totalCalories - proteinCalories - fatCalories;
    const carbsGrams = Math.round(carbsCalories / 4);

    setCalories(totalCalories);
    setProtein(proteinGrams);
    setFat(fatGrams);
    setCarbs(carbsGrams);
  }, [gender, age, weight, height, activity, goal]);

  // Автоматический пересчёт макроэлементов при изменении полей
  useEffect(() => {
    calculateMacros();
  }, [calculateMacros]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!userId) {
      setError("ID пользователя не найден");
      return;
    }

    // Пересчитываем макроэлементы перед отправкой
    calculateMacros();

    if (!gender || !age || !weight || !height || !activity || !goal) {
      setError("Заполните все обязательные поля");
      return;
    }

    if (!calories || !protein || !fat || !carbs) {
      setError("Не удалось рассчитать калории и макроэлементы");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/save?id=${userId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          gender,
          age: Number(age),
          weight: Number(weight),
          height: Number(height),
          activity,
          goal,
          calories,
          protein,
          fat,
          carbs
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Ошибка сохранения данных");
        return;
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      console.error("Ошибка отправки формы:", err);
      setError("Не удалось отправить данные. Попробуйте позже.");
    } finally {
      setLoading(false);
    }
  };

  if (error && !userId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
          <h2 className="text-xl font-semibold mb-2 text-red-600">Ошибка</h2>
          <p className="text-gray-700">{error}</p>
          <p className="text-sm text-gray-500 mt-4">Запустите анкету через Telegram бота</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Мой путь к балансу</h1>
        <p className="text-gray-600 mb-6">Заполните анкету для расчёта вашей дневной нормы</p>

        {success && (
          <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
            ✅ Данные успешно сохранены!
          </div>
        )}

        {error && userId && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            ❌ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Пол *</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            >
              <option value="">Выберите пол</option>
              <option value="male">Мужской</option>
              <option value="female">Женский</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Возраст *</label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              min="1"
              max="120"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Вес (кг) *</label>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              min="1"
              step="0.1"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Рост (см) *</label>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              min="1"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Уровень активности *</label>
            <select
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            >
              <option value="">Выберите уровень активности</option>
              <option value="sedentary">Малоподвижный (сидячая работа, мало спорта)</option>
              <option value="light">Лёгкая активность (тренировки 1-3 раза в неделю)</option>
              <option value="moderate">Умеренная активность (тренировки 3-5 раз в неделю)</option>
              <option value="active">Высокая активность (тренировки 6-7 раз в неделю)</option>
              <option value="very_active">Очень высокая активность (тренировки 2 раза в день)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Цель *</label>
            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            >
              <option value="">Выберите цель</option>
              <option value="lose">Похудеть</option>
              <option value="maintain">Поддерживать вес</option>
              <option value="gain">Набрать вес</option>
            </select>
          </div>

          {(calories || protein || fat || carbs) && (
            <div className="p-4 bg-green-50 rounded-md border border-green-200">
              <h3 className="font-semibold mb-3">Ваша дневная норма:</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Калории:</span>
                  <span className="ml-2 font-semibold">{calories} ккал</span>
                </div>
                <div>
                  <span className="text-gray-600">Белки:</span>
                  <span className="ml-2 font-semibold">{protein} г</span>
                </div>
                <div>
                  <span className="text-gray-600">Жиры:</span>
                  <span className="ml-2 font-semibold">{fat} г</span>
                </div>
                <div>
                  <span className="text-gray-600">Углеводы:</span>
                  <span className="ml-2 font-semibold">{carbs} г</span>
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Сохранение..." : "Сохранить данные"}
          </button>
        </form>
      </div>
    </div>
  );
}


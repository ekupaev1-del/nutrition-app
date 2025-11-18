"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./globals.css";

export default function StatsPage() {
  const searchParams = useSearchParams();
  const userIdParam = searchParams.get("id");
  const [userId, setUserId] = useState<number | null>(null);
  const [view, setView] = useState<"menu" | "report" | "edit">("menu");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Данные для отчета
  const [reportStartDate, setReportStartDate] = useState<string>("");
  const [reportEndDate, setReportEndDate] = useState<string>("");
  const [reportData, setReportData] = useState<any[] | null>(null);
  const [reportTotals, setReportTotals] = useState<any>(null);

  // Данные для редактирования
  const [mealsList, setMealsList] = useState<any[]>([]);
  const [editingMeal, setEditingMeal] = useState<any | null>(null);

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
      setError("ID не передан");
    }
  }, [userIdParam]);

  // Устанавливаем даты по умолчанию (сегодня и неделя назад)
  useEffect(() => {
    const today = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    setReportEndDate(today.toISOString().split("T")[0]);
    setReportStartDate(weekAgo.toISOString().split("T")[0]);
  }, []);

  const loadMealsForEdit = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/meals?userId=${userId}`);
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        setMealsList(data.meals || []);
      }
    } catch (err) {
      setError("Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    if (!userId || !reportStartDate || !reportEndDate) {
      setError("Выберите период");
      return;
    }

    setLoading(true);
    try {
      const start = new Date(reportStartDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(reportEndDate);
      end.setHours(23, 59, 59, 999);

      const response = await fetch(
        `/api/report?userId=${userId}&start=${start.toISOString()}&end=${end.toISOString()}`
      );
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        setReportData(data.meals || []);
        setReportTotals(data.totals || null);
      }
    } catch (err) {
      setError("Ошибка генерации отчета");
    } finally {
      setLoading(false);
    }
  };

  const deleteMeal = async (mealId: number) => {
    if (!confirm("Удалить этот прием пищи?")) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/meals/${mealId}`, {
        method: "DELETE"
      });
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        await loadMealsForEdit();
        setEditingMeal(null);
      }
    } catch (err) {
      setError("Ошибка удаления");
    } finally {
      setLoading(false);
    }
  };

  const updateMeal = async (mealId: number, updates: any) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/meals/${mealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      });
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        await loadMealsForEdit();
        setEditingMeal(null);
      }
    } catch (err) {
      setError("Ошибка обновления");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (view === "edit") {
      loadMealsForEdit();
    }
  }, [view, userId]);

  if (error && !userId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-soft p-6 text-center">
          <h2 className="text-xl font-semibold mb-2 text-red-600">Ошибка</h2>
          <p className="text-textPrimary">{error}</p>
        </div>
      </div>
    );
  }

  // Главное меню
  if (view === "menu") {
    return (
      <div className="min-h-screen bg-background p-4 py-8">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-soft p-8">
          <h1 className="text-2xl font-bold mb-6 text-textPrimary text-center">
            📊 Статистика
          </h1>

          <div className="space-y-4">
            <button
              onClick={() => setView("report")}
              className="w-full py-4 px-6 bg-accent text-white font-semibold rounded-xl shadow-soft hover:opacity-90 transition-opacity text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">📋</span>
                <div>
                  <div className="font-bold">Получить отчет</div>
                  <div className="text-sm opacity-90">Выберите период времени</div>
                </div>
              </div>
            </button>

            <button
              onClick={() => setView("edit")}
              className="w-full py-4 px-6 bg-accent text-white font-semibold rounded-xl shadow-soft hover:opacity-90 transition-opacity text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">✏️</span>
                <div>
                  <div className="font-bold">Редактировать прием пищи</div>
                  <div className="text-sm opacity-90">Удалить или изменить еду</div>
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
                  (window as any).Telegram.WebApp.close();
                }
              }}
              className="w-full py-3 px-6 bg-gray-100 text-textPrimary font-medium rounded-xl hover:bg-gray-200 transition-colors"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Страница отчета
  if (view === "report") {
    return (
      <div className="min-h-screen bg-background p-4 py-8">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-soft p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-textPrimary">📋 Получить отчет</h2>
            <button
              onClick={() => setView("menu")}
              className="text-textSecondary hover:text-textPrimary"
            >
              ← Назад
            </button>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-textPrimary mb-2">
                Начало периода
              </label>
              <input
                type="date"
                value={reportStartDate}
                onChange={(e) => setReportStartDate(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-accent transition-colors bg-white text-textPrimary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-textPrimary mb-2">
                Конец периода
              </label>
              <input
                type="date"
                value={reportEndDate}
                onChange={(e) => setReportEndDate(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-accent transition-colors bg-white text-textPrimary"
              />
            </div>
          </div>

          <button
            onClick={generateReport}
            disabled={loading || !reportStartDate || !reportEndDate}
            className="w-full py-4 px-6 bg-accent text-white font-semibold rounded-xl shadow-soft hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed mb-4"
          >
            {loading ? "Генерирую отчет..." : "Сгенерировать отчет"}
          </button>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">
              {error}
            </div>
          )}

          {reportData && reportTotals && (
            <div className="mt-6 space-y-4">
              <div className="p-4 bg-accent/10 rounded-xl">
                <h3 className="font-semibold text-textPrimary mb-2">Итого за период:</h3>
                <div className="space-y-1 text-sm">
                  <div>🔥 {reportTotals.calories.toFixed(0)} ккал</div>
                  <div>🥚 {reportTotals.protein.toFixed(1)} г белков</div>
                  <div>🥥 {reportTotals.fat.toFixed(1)} г жиров</div>
                  <div>🍚 {reportTotals.carbs.toFixed(1)} г углеводов</div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-textPrimary">Приемы пищи:</h3>
                {reportData.map((meal, index) => {
                  const date = new Date(meal.created_at);
                  return (
                    <div key={meal.id} className="p-4 border border-gray-200 rounded-xl">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-medium text-textPrimary">{meal.meal_text}</div>
                          <div className="text-xs text-textSecondary">
                            {date.toLocaleDateString("ru-RU")} {date.toLocaleTimeString("ru-RU", {
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-textSecondary">
                        🔥 {meal.calories} ккал | 🥚 {Number(meal.protein).toFixed(1)}г | 🥥 {Number(meal.fat).toFixed(1)}г | 🍚 {Number(meal.carbs || 0).toFixed(1)}г
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Страница редактирования
  if (view === "edit") {
    return (
      <div className="min-h-screen bg-background p-4 py-8">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-soft p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-textPrimary">✏️ Редактировать прием пищи</h2>
            <button
              onClick={() => {
                setView("menu");
                setEditingMeal(null);
              }}
              className="text-textSecondary hover:text-textPrimary"
            >
              ← Назад
            </button>
          </div>

          {loading && !editingMeal && (
            <div className="text-center text-textSecondary py-4">Загрузка...</div>
          )}

          {editingMeal ? (
            <EditMealForm
              meal={editingMeal}
              onSave={(updates) => updateMeal(editingMeal.id, updates)}
              onCancel={() => setEditingMeal(null)}
              onDelete={() => deleteMeal(editingMeal.id)}
            />
          ) : (
            <div className="space-y-3">
              {mealsList.length === 0 ? (
                <div className="text-center text-textSecondary py-8">
                  Нет записей о приемах пищи
                </div>
              ) : (
                mealsList.map((meal) => {
                  const date = new Date(meal.created_at);
                  return (
                    <div
                      key={meal.id}
                      className="p-4 border border-gray-200 rounded-xl hover:border-accent transition-colors cursor-pointer"
                      onClick={() => setEditingMeal(meal)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-medium text-textPrimary mb-1">{meal.meal_text}</div>
                          <div className="text-xs text-textSecondary mb-2">
                            {date.toLocaleDateString("ru-RU")} {date.toLocaleTimeString("ru-RU", {
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </div>
                          <div className="text-sm text-textSecondary">
                            🔥 {meal.calories} ккал | 🥚 {Number(meal.protein).toFixed(1)}г | 🥥 {Number(meal.fat).toFixed(1)}г | 🍚 {Number(meal.carbs || 0).toFixed(1)}г
                          </div>
                        </div>
                        <span className="text-textSecondary">✏️</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

function EditMealForm({
  meal,
  onSave,
  onCancel,
  onDelete
}: {
  meal: any;
  onSave: (updates: any) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [mealText, setMealText] = useState(meal.meal_text || "");
  const [calories, setCalories] = useState(meal.calories?.toString() || "0");
  const [protein, setProtein] = useState(meal.protein?.toString() || "0");
  const [fat, setFat] = useState(meal.fat?.toString() || "0");
  const [carbs, setCarbs] = useState(meal.carbs?.toString() || "0");

  const handleSave = () => {
    onSave({
      meal_text: mealText,
      calories: Number(calories),
      protein: Number(protein),
      fat: Number(fat),
      carbs: Number(carbs)
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-textPrimary mb-2">Название блюда</label>
        <input
          type="text"
          value={mealText}
          onChange={(e) => setMealText(e.target.value)}
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-accent transition-colors bg-white text-textPrimary"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-textPrimary mb-2">🔥 Калории</label>
          <input
            type="number"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-accent transition-colors bg-white text-textPrimary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-textPrimary mb-2">🥚 Белки (г)</label>
          <input
            type="number"
            step="0.1"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-accent transition-colors bg-white text-textPrimary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-textPrimary mb-2">🥥 Жиры (г)</label>
          <input
            type="number"
            step="0.1"
            value={fat}
            onChange={(e) => setFat(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-accent transition-colors bg-white text-textPrimary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-textPrimary mb-2">🍚 Углеводы (г)</label>
          <input
            type="number"
            step="0.1"
            value={carbs}
            onChange={(e) => setCarbs(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-accent transition-colors bg-white text-textPrimary"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          className="flex-1 py-3 px-6 bg-accent text-white font-semibold rounded-xl shadow-soft hover:opacity-90 transition-opacity"
        >
          Сохранить
        </button>
        <button
          onClick={onCancel}
          className="px-6 py-3 bg-gray-100 text-textPrimary font-medium rounded-xl hover:bg-gray-200 transition-colors"
        >
          Отмена
        </button>
        <button
          onClick={onDelete}
          className="px-6 py-3 bg-red-100 text-red-700 font-medium rounded-xl hover:bg-red-200 transition-colors"
        >
          Удалить
        </button>
      </div>
    </div>
  );
}


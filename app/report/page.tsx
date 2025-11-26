"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense, useCallback } from "react";
import "../globals.css";

interface Meal {
  id: number;
  user_id: number;
  meal_text: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  created_at: string;
}

interface DayMeals {
  date: string;
  meals: Meal[];
}

interface ReportData {
  mealsByDay: DayMeals[];
  totals: {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
  };
  dailyNorm: number;
  periodNorm: number;
  periodDays: number;
  percentage: number;
  mealsCount: number;
}

type ReportPeriod = "today" | "week" | "month" | "custom";

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-textSecondary">Загрузка...</div>
    </div>
  );
}

function ReportPageContent() {
  const searchParams = useSearchParams();
  const userIdParam = searchParams.get("id");
  
  const [userId, setUserId] = useState<number | null>(null);
  const [view, setView] = useState<"period-select" | "report">("period-select");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Данные отчёта (только для отображения, не вычисляем на фронте)
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod | null>(null);
  const [reportStartDate, setReportStartDate] = useState<string>("");
  const [reportEndDate, setReportEndDate] = useState<string>("");

  // Данные для редактирования
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);

  // Пагинация для длинных периодов
  const [visibleDays, setVisibleDays] = useState(7); // Показываем первые 7 дней

  // Инициализация userId
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

  // Устанавливаем даты по умолчанию
  useEffect(() => {
    const today = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    setReportEndDate(today.toISOString().split("T")[0]);
    setReportStartDate(weekAgo.toISOString().split("T")[0]);
  }, []);

  /**
   * Вычисляет границы периода в локальном времени пользователя
   */
  const getPeriodBounds = useCallback((period: ReportPeriod): { start: string; end: string } => {
    const today = new Date();
    let start: Date;
    let end: Date;

    switch (period) {
      case "today":
        start = new Date(today);
        start.setHours(0, 0, 0, 0);
        end = new Date(today);
        end.setHours(23, 59, 59, 999);
        break;
      case "week":
        end = new Date(today);
        end.setHours(23, 59, 59, 999);
        start = new Date(today);
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        break;
      case "month":
        end = new Date(today);
        end.setHours(23, 59, 59, 999);
        start = new Date(today);
        start.setDate(start.getDate() - 29);
        start.setHours(0, 0, 0, 0);
        break;
      case "custom":
        start = new Date(reportStartDate);
        start.setHours(0, 0, 0, 0);
        end = new Date(reportEndDate);
        end.setHours(23, 59, 59, 999);
        break;
    }

    return {
      start: start.toISOString().split("T")[0], // YYYY-MM-DD
      end: end.toISOString().split("T")[0]
    };
  }, [reportStartDate, reportEndDate]);

  /**
   * Загружает отчёт с сервера
   * ВСЯ логика формирования отчёта на бэкенде, фронт только отображает
   */
  const loadReport = useCallback(async (period: ReportPeriod) => {
    if (!userId) {
      setError("Пользователь не найден");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { start, end } = getPeriodBounds(period);

      // ВСЕГДА добавляем уникальный timestamp для предотвращения кеширования
      const timestamp = Date.now();
      const response = await fetch(
        `/api/report?userId=${userId}&periodStart=${start}&periodEnd=${end}&_t=${timestamp}`,
        {
          method: 'GET',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'X-Request-ID': `report-${timestamp}-${Math.random()}`
          }
        }
      );

      const data = await response.json();

      if (!data.ok) {
        console.error("[loadReport] Ошибка от API:", data.error);
        setError(data.error || "Ошибка загрузки отчёта");
        setReportData(null);
        return;
      }

      // Получаем готовый отчёт с бэкенда (без вычислений на фронте)
      console.log("[loadReport] Получены данные от API:", {
        mealsCount: data.report?.mealsCount,
        totals: data.report?.totals,
        daysCount: data.report?.mealsByDay?.length
      });
      
      // ВСЕГДА создаём новый объект для принудительного re-render
      setReportData({ ...data.report });
      setReportPeriod(period);
      setView("report");
      setVisibleDays(7); // Сбрасываем пагинацию
      
      console.log("[loadReport] State обновлён, reportData установлен");
    } catch (err: any) {
      console.error("[loadReport] Ошибка:", err);
      setError(err.message || "Ошибка загрузки отчёта");
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }, [userId, getPeriodBounds]);

  /**
   * Обновляет приём пищи
   * После обновления ВСЕГДА перезагружает отчёт с сервера
   */
  const updateMeal = useCallback(async (mealId: number, updates: Partial<Meal>) => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/meals/${mealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        cache: 'no-store'
      });

      const data = await response.json();

      if (!data.ok) {
        console.error("[updateMeal] Ошибка от API:", data.error);
        setError(data.error || "Ошибка обновления");
        return;
      }

      console.log("[updateMeal] Приём пищи обновлён, перезагружаем отчёт...", {
        mealId,
        updates,
        currentReportPeriod: reportPeriod
      });
      
      // Закрываем форму редактирования
      setEditingMeal(null);

      // ВСЕГДА перезагружаем отчёт с сервера (не обновляем локальный state)
      // КРИТИЧНО: если reportPeriod не установлен, используем последний сохранённый период
      const periodToReload = reportPeriod || (reportData ? "today" : null);
      
      if (periodToReload) {
        console.log("[updateMeal] Перезагружаем отчёт для периода:", periodToReload);
        await new Promise(resolve => setTimeout(resolve, 500)); // Даём БД время на обновление
        await loadReport(periodToReload);
        console.log("[updateMeal] Отчёт перезагружен");
      } else {
        console.warn("[updateMeal] Не удалось определить период для перезагрузки");
      }
    } catch (err: any) {
      console.error("[updateMeal] Ошибка:", err);
      setError(err.message || "Ошибка обновления");
    } finally {
      setLoading(false);
    }
  }, [userId, reportPeriod, loadReport, reportData]);

  /**
   * Удаляет приём пищи
   * После удаления ВСЕГДА перезагружает отчёт с сервера
   */
  const deleteMeal = useCallback(async (mealId: number) => {
    if (!confirm("Удалить этот приём пищи?")) return;
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/meals/${mealId}`, {
        method: "DELETE",
        cache: 'no-store'
      });

      const data = await response.json();

      if (!data.ok) {
        console.error("[deleteMeal] Ошибка от API:", data.error);
        setError(data.error || "Ошибка удаления");
        return;
      }

      console.log("[deleteMeal] Приём пищи удалён, перезагружаем отчёт...", {
        mealId,
        currentReportPeriod: reportPeriod
      });
      
      // Закрываем форму редактирования
      setEditingMeal(null);

      // ВСЕГДА перезагружаем отчёт с сервера (не обновляем локальный state)
      // КРИТИЧНО: если reportPeriod не установлен, используем последний сохранённый период
      const periodToReload = reportPeriod || (reportData ? "today" : null);
      
      if (periodToReload) {
        console.log("[deleteMeal] Перезагружаем отчёт для периода:", periodToReload);
        await new Promise(resolve => setTimeout(resolve, 500)); // Даём БД время на обновление
        await loadReport(periodToReload);
        console.log("[deleteMeal] Отчёт перезагружен");
      } else {
        console.warn("[deleteMeal] Не удалось определить период для перезагрузки");
      }
    } catch (err: any) {
      console.error("[deleteMeal] Ошибка:", err);
      setError(err.message || "Ошибка удаления");
    } finally {
      setLoading(false);
    }
  }, [userId, reportPeriod, loadReport, reportData]);

  /**
   * Автоматическое обновление отчёта при фокусе окна
   */
  useEffect(() => {
    if (view === "report" && reportPeriod && userId && !loading) {
      const handleFocus = () => {
        console.log("[report] Окно получило фокус, обновляем отчёт...");
        loadReport(reportPeriod);
      };

      const handleVisibilityChange = () => {
        if (!document.hidden) {
          console.log("[report] Страница стала видимой, обновляем отчёт...");
          loadReport(reportPeriod);
        }
      };

      window.addEventListener("focus", handleFocus);
      document.addEventListener("visibilitychange", handleVisibilityChange);

      return () => {
        window.removeEventListener("focus", handleFocus);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      };
    }
  }, [view, reportPeriod, userId, loadReport, loading]);

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

  // Выбор периода
  if (view === "period-select") {
    return (
      <div className="min-h-screen bg-background p-4 py-8">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-soft p-8">
          <h1 className="text-2xl font-bold mb-6 text-textPrimary text-center">
            📋 Получить отчет
          </h1>

          <div className="mb-4">
            <p className="text-textSecondary text-center mb-6">Выберите период:</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => loadReport("today")}
              disabled={loading}
              className="w-full py-4 px-6 bg-accent text-white font-semibold rounded-xl shadow-soft hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Сегодня
            </button>

            <button
              onClick={() => loadReport("week")}
              disabled={loading}
              className="w-full py-4 px-6 bg-accent text-white font-semibold rounded-xl shadow-soft hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Неделя
            </button>

            <button
              onClick={() => loadReport("month")}
              disabled={loading}
              className="w-full py-4 px-6 bg-accent text-white font-semibold rounded-xl shadow-soft hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Месяц
            </button>

            <button
              onClick={() => setView("report")}
              className="w-full py-4 px-6 bg-accent/20 text-accent font-semibold rounded-xl hover:bg-accent/30 transition-colors"
            >
              Выбранный период
            </button>

            <button
              onClick={() => {
                if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
                  (window as any).Telegram.WebApp.close();
                }
              }}
              className="w-full py-3 px-6 bg-gray-100 text-textPrimary font-medium rounded-xl hover:bg-gray-200 transition-colors mt-4"
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
            <h2 className="text-xl font-bold text-textPrimary">📋 Отчет</h2>
            <div className="flex items-center gap-2">
              {reportData && reportPeriod && (
                <button
                  onClick={() => loadReport(reportPeriod)}
                  disabled={loading}
                  className="px-3 py-1.5 text-sm bg-accent/20 text-accent font-medium rounded-lg hover:bg-accent/30 transition-colors disabled:opacity-50"
                  title="Обновить отчет"
                >
                  🔄
                </button>
              )}
              <button
                onClick={() => {
                  setView("period-select");
                  setReportData(null);
                  setReportPeriod(null);
                }}
                className="text-textSecondary hover:text-textPrimary"
              >
                ← Назад
              </button>
            </div>
          </div>

          {!reportData && !reportPeriod && (
            <>
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
                onClick={() => loadReport("custom")}
                disabled={loading || !reportStartDate || !reportEndDate}
                className="w-full py-4 px-6 bg-accent text-white font-semibold rounded-xl shadow-soft hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed mb-4"
              >
                {loading ? "Генерирую отчет..." : "Сгенерировать отчет"}
              </button>
            </>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">
              {error}
            </div>
          )}

          {loading && reportData && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm mb-4">
              Обновление...
            </div>
          )}

          {editingMeal ? (
            <EditMealForm
              meal={editingMeal}
              onSave={(updates) => updateMeal(editingMeal.id, updates)}
              onCancel={() => setEditingMeal(null)}
              onDelete={() => deleteMeal(editingMeal.id)}
            />
          ) : reportData && (
            <div className="mt-6 space-y-4">
              {/* Итоги за период (данные с бэкенда) */}
              <div className="p-4 bg-accent/10 rounded-xl">
                <h3 className="font-semibold text-textPrimary mb-2">Итого за период:</h3>
                <div className="space-y-1 text-sm">
                  <div className="mb-2 pb-2 border-b border-gray-200">
                    <div className="font-medium">
                      🔥 {reportData.totals.calories.toFixed(0)} / {reportData.periodNorm.toFixed(0)} ккал ({reportData.percentage.toFixed(1)}%)
                    </div>
                  </div>
                  <div>🔥 {reportData.totals.calories.toFixed(0)} ккал</div>
                  <div>🥚 {reportData.totals.protein.toFixed(1)} г белков</div>
                  <div>🥥 {reportData.totals.fat.toFixed(1)} г жиров</div>
                  <div>🍚 {reportData.totals.carbs.toFixed(1)} г углеводов</div>
                </div>
              </div>

              {/* Список приёмов пищи по дням (данные с бэкенда) */}
              <div className="space-y-3">
                <h3 className="font-semibold text-textPrimary">Приемы пищи:</h3>
                {reportData.mealsByDay.length === 0 ? (
                  <div className="text-center text-textSecondary py-8">
                    Нет записей за выбранный период
                  </div>
                ) : (
                  <>
                    {reportData.mealsByDay.slice(0, visibleDays).map((dayData) => {
                      const dayDate = new Date(dayData.date);
                      const dayNames = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
                      const dayName = dayNames[dayDate.getDay()];
                      const formattedDate = dayDate.toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "long"
                      });

                      return (
                        <div key={dayData.date}>
                          <div className="text-lg font-bold text-textPrimary mb-3 mt-6 first:mt-0 py-2 px-3 bg-accent/15 rounded-lg border-l-4 border-accent">
                            🗓️ {formattedDate}, {dayName}
                          </div>
                          {dayData.meals.map((meal) => {
                            const mealDate = new Date(meal.created_at);
                            return (
                              <div key={meal.id} className="p-4 border border-gray-200 rounded-xl hover:border-accent transition-colors mb-3">
                                <div className="flex justify-between items-start mb-2">
                                  <div className="flex-1">
                                    <div className="font-medium text-textPrimary">{meal.meal_text}</div>
                                    <div className="text-xs text-textSecondary mt-1">
                                      {mealDate.toLocaleTimeString("ru-RU", {
                                        hour: "2-digit",
                                        minute: "2-digit"
                                      })}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-sm text-textSecondary mb-3">
                                  🔥 {meal.calories} ккал | 🥚 {Number(meal.protein).toFixed(1)}г | 🥥 {Number(meal.fat).toFixed(1)}г | 🍚 {Number(meal.carbs || 0).toFixed(1)}г
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => setEditingMeal(meal)}
                                    className="flex-1 py-2 px-4 bg-accent/20 text-accent font-medium rounded-lg hover:bg-accent/30 transition-colors text-sm"
                                  >
                                    ✏️ Редактировать
                                  </button>
                                  <button
                                    onClick={() => deleteMeal(meal.id)}
                                    className="flex-1 py-2 px-4 bg-red-100 text-red-700 font-medium rounded-lg hover:bg-red-200 transition-colors text-sm"
                                  >
                                    🗑️ Удалить
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}

                    {/* Пагинация: показать ещё */}
                    {reportData.mealsByDay.length > visibleDays && (
                      <button
                        onClick={() => setVisibleDays(prev => prev + 7)}
                        className="w-full py-3 px-6 bg-accent/20 text-accent font-medium rounded-xl hover:bg-accent/30 transition-colors"
                      >
                        Показать ещё ({reportData.mealsByDay.length - visibleDays} дней)
                      </button>
                    )}
                  </>
                )}
              </div>
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
  meal: Meal;
  onSave: (updates: Partial<Meal>) => void;
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
      <h3 className="text-lg font-semibold text-textPrimary mb-4">Редактировать приём пищи</h3>
      
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
          type="button"
          onClick={handleSave}
          className="flex-1 py-3 px-6 bg-accent text-white font-semibold rounded-xl shadow-soft hover:opacity-90 transition-opacity"
        >
          Сохранить
        </button>
        <button
          type="button"
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

export default function ReportPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ReportPageContent />
    </Suspense>
  );
}


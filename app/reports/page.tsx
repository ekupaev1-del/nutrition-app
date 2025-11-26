"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense, useCallback } from "react";
import "../globals.css";

// export const dynamic = 'force-dynamic'; // Убрано, так как это клиентский компонент

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

interface ReportTotals {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

type ReportPeriod = "today" | "week" | "month" | "custom";

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-textSecondary">Загрузка...</div>
    </div>
  );
}

function ReportsPageContent() {
  const searchParams = useSearchParams();
  const userIdParam = searchParams.get("id");
  
  const [userId, setUserId] = useState<number | null>(null);
  const [view, setView] = useState<"period-select" | "report">("period-select");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Данные для отчета
  const [reportStartDate, setReportStartDate] = useState<string>("");
  const [reportEndDate, setReportEndDate] = useState<string>("");
  const [reportData, setReportData] = useState<Meal[]>([]);
  const [reportTotals, setReportTotals] = useState<ReportTotals | null>(null);
  const [dailyNorm, setDailyNorm] = useState<number | null>(null);
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod | null>(null);

  // Данные для редактирования
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);

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
   * и конвертирует их в UTC для запроса к API
   */
  const getPeriodBounds = useCallback((period: ReportPeriod): { startUTC: Date; endUTC: Date } => {
    const now = new Date();
    let localStart: Date;
    let localEnd: Date;

    switch (period) {
      case "today":
        localStart = new Date(now);
        localStart.setHours(0, 0, 0, 0);
        localEnd = new Date(now);
        localEnd.setHours(23, 59, 59, 999);
        break;
      case "week":
        localEnd = new Date(now);
        localEnd.setHours(23, 59, 59, 999);
        localStart = new Date(now);
        localStart.setDate(localStart.getDate() - 6);
        localStart.setHours(0, 0, 0, 0);
        break;
      case "month":
        localEnd = new Date(now);
        localEnd.setHours(23, 59, 59, 999);
        localStart = new Date(now);
        localStart.setDate(localStart.getDate() - 29);
        localStart.setHours(0, 0, 0, 0);
        break;
      case "custom":
        localStart = new Date(reportStartDate);
        localStart.setHours(0, 0, 0, 0);
        localEnd = new Date(reportEndDate);
        localEnd.setHours(23, 59, 59, 999);
        break;
    }

    // JavaScript автоматически конвертирует локальное время в UTC при toISOString()
    return {
      startUTC: localStart,
      endUTC: localEnd
    };
  }, [reportStartDate, reportEndDate]);

  /**
   * Загружает отчёт с сервера
   * ВСЕГДА делает свежий запрос к базе данных
   */
  const loadReport = useCallback(async (period: ReportPeriod) => {
    if (!userId) {
      setError("Пользователь не найден");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { startUTC, endUTC } = getPeriodBounds(period);

      // ВСЕГДА добавляем уникальный timestamp для предотвращения кеширования
      const timestamp = Date.now();
      const response = await fetch(
        `/api/reports?userId=${userId}&start=${startUTC.toISOString()}&end=${endUTC.toISOString()}&_t=${timestamp}`,
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
        setReportData([]);
        setReportTotals(null);
        return;
      }

      // Получаем данные из ответа
      const meals: Meal[] = data.meals || [];
      const dailyNormValue = data.dailyNorm || null;

      // Вычисляем итоги
      const totals: ReportTotals = meals.reduce(
        (acc, meal) => ({
          calories: acc.calories + Number(meal.calories || 0),
          protein: acc.protein + Number(meal.protein || 0),
          fat: acc.fat + Number(meal.fat || 0),
          carbs: acc.carbs + Number(meal.carbs || 0)
        }),
        { calories: 0, protein: 0, fat: 0, carbs: 0 }
      );

      // Обновляем состояние - ВСЕГДА создаём новые объекты/массивы для принудительного re-render
      setReportData([...meals]);
      setReportTotals({ ...totals });
      setDailyNorm(dailyNormValue);
      setReportPeriod(period);
      setView("report");
    } catch (err: any) {
      console.error("[loadReport] Ошибка:", err);
      setError(err.message || "Ошибка загрузки отчёта");
      setReportData([]);
      setReportTotals(null);
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

      console.log("[updateMeal] Приём пищи обновлён, перезагружаем отчёт...");
      
      // Закрываем форму редактирования
      setEditingMeal(null);

      // ВСЕГДА перезагружаем отчёт с сервера после обновления
      // Добавляем небольшую задержку, чтобы дать базе данных время на обновление
      if (reportPeriod) {
        // Используем Promise для правильной работы с async
        await new Promise(resolve => setTimeout(resolve, 500));
        await loadReport(reportPeriod);
      }
    } catch (err: any) {
      console.error("[updateMeal] Ошибка:", err);
      setError(err.message || "Ошибка обновления");
    } finally {
      setLoading(false);
    }
  }, [userId, reportPeriod, loadReport]);

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

      console.log("[deleteMeal] Приём пищи удалён, перезагружаем отчёт...");
      
      // Закрываем форму редактирования
      setEditingMeal(null);

      // ВСЕГДА перезагружаем отчёт с сервера после удаления
      // Добавляем небольшую задержку, чтобы дать базе данных время на обновление
      if (reportPeriod) {
        // Используем Promise для правильной работы с async
        await new Promise(resolve => setTimeout(resolve, 500));
        await loadReport(reportPeriod);
      }
    } catch (err: any) {
      console.error("[deleteMeal] Ошибка:", err);
      setError(err.message || "Ошибка удаления");
    } finally {
      setLoading(false);
    }
  }, [userId, reportPeriod, loadReport]);

  /**
   * Автоматическое обновление отчёта при фокусе окна или изменении видимости
   * Это гарантирует, что данные всегда актуальны после операций в боте
   */
  useEffect(() => {
    if (view === "report" && reportPeriod && userId && !loading) {
      const handleFocus = () => {
        console.log("[reports] Окно получило фокус, обновляем отчёт...");
        loadReport(reportPeriod);
      };

      const handleVisibilityChange = () => {
        if (!document.hidden) {
          console.log("[reports] Страница стала видимой, обновляем отчёт...");
          loadReport(reportPeriod);
        }
      };

      // Обновляем при фокусе окна
      window.addEventListener("focus", handleFocus);
      // Обновляем при изменении видимости страницы
      document.addEventListener("visibilitychange", handleVisibilityChange);

      return () => {
        window.removeEventListener("focus", handleFocus);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      };
    }
  }, [view, reportPeriod, userId, loadReport, loading]);

  /**
   * Периодическое обновление отчёта каждые 10 секунд, если отчёт открыт
   * Это гарантирует, что новые данные из бота появятся в отчёте
   */
  useEffect(() => {
    if (view === "report" && reportPeriod && userId && !loading) {
      const interval = setInterval(() => {
        console.log("[reports] Периодическое обновление отчёта...");
        loadReport(reportPeriod);
      }, 10000); // Обновляем каждые 10 секунд

      return () => clearInterval(interval);
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
              {reportData.length > 0 && reportPeriod && (
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
                  setReportData([]);
                  setReportTotals(null);
                  setReportPeriod(null);
                }}
                className="text-textSecondary hover:text-textPrimary"
              >
                ← Назад
              </button>
            </div>
          </div>

          {!reportData.length && !reportPeriod && (
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

          {loading && reportData.length > 0 && (
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
          ) : reportData.length > 0 && reportTotals && (
            <div className="mt-6 space-y-4">
              {/* Итоги за период */}
              <div className="p-4 bg-accent/10 rounded-xl">
                <h3 className="font-semibold text-textPrimary mb-2">Итого за период:</h3>
                <div className="space-y-1 text-sm">
                  {dailyNorm && (
                    <div className="mb-2 pb-2 border-b border-gray-200">
                      {(() => {
                        let periodNorm = dailyNorm;
                        if (reportPeriod === "week") periodNorm = dailyNorm * 7;
                        else if (reportPeriod === "month") periodNorm = dailyNorm * 30;
                        else if (reportPeriod === "custom") {
                          const start = new Date(reportStartDate);
                          const end = new Date(reportEndDate);
                          const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                          periodNorm = dailyNorm * days;
                        }
                        const percentage = (reportTotals.calories / periodNorm) * 100;
                        return (
                          <div className="font-medium">
                            🔥 {reportTotals.calories.toFixed(0)} / {periodNorm.toFixed(0)} ккал ({percentage.toFixed(1)}%)
                          </div>
                        );
                      })()}
                    </div>
                  )}
                  <div>🔥 {reportTotals.calories.toFixed(0)} ккал</div>
                  <div>🥚 {reportTotals.protein.toFixed(1)} г белков</div>
                  <div>🥥 {reportTotals.fat.toFixed(1)} г жиров</div>
                  <div>🍚 {reportTotals.carbs.toFixed(1)} г углеводов</div>
                </div>
              </div>

              {/* Список приёмов пищи */}
              <div className="space-y-3">
                <h3 className="font-semibold text-textPrimary">Приемы пищи:</h3>
                {reportData.map((meal, index) => {
                  // Конвертируем UTC из базы в локальное время для отображения
                  const mealDate = new Date(meal.created_at);
                  
                  const dayNames = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
                  const dayName = dayNames[mealDate.getDay()];
                  const formattedDate = mealDate.toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "long"
                  });
                  
                  // Проверяем, нужно ли показывать дату
                  const prevMeal = index > 0 ? reportData[index - 1] : null;
                  let showDate = true;
                  if (prevMeal) {
                    const prevDate = new Date(prevMeal.created_at);
                    showDate = mealDate.toDateString() !== prevDate.toDateString();
                  }
                  
                  return (
                    <div key={meal.id}>
                      {showDate && (
                        <div className="text-lg font-bold text-textPrimary mb-3 mt-6 first:mt-0 py-2 px-3 bg-accent/15 rounded-lg border-l-4 border-accent">
                          🗓️ {formattedDate}, {dayName}
                        </div>
                      )}
                      <div className="p-4 border border-gray-200 rounded-xl hover:border-accent transition-colors">
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
                        <div className="flex gap-2 mt-3">
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
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {reportData.length === 0 && reportPeriod && !loading && (
            <div className="text-center text-textSecondary py-8">
              Нет записей за выбранный период
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

export default function ReportsPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ReportsPageContent />
    </Suspense>
  );
}


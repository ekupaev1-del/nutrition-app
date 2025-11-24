"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "../globals.css";

export const dynamic = 'force-dynamic';

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-textSecondary">Загрузка...</div>
    </div>
  );
}

function StatsPageContent() {
  const searchParams = useSearchParams();
  const userIdParam = searchParams.get("id");
  const initialView = searchParams.get("view") || "menu";
  const [userId, setUserId] = useState<number | null>(null);
  const [view, setView] = useState<"menu" | "report" | "edit">(initialView as "menu" | "report" | "edit");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Данные для отчета
  const [reportStartDate, setReportStartDate] = useState<string>("");
  const [reportEndDate, setReportEndDate] = useState<string>("");
  const [reportData, setReportData] = useState<any[] | null>(null);
  const [reportTotals, setReportTotals] = useState<any>(null);
  const [dailyNorm, setDailyNorm] = useState<number | null>(null);
  const [reportPeriod, setReportPeriod] = useState<"today" | "week" | "month" | "year" | "custom" | null>(null);
  const [reportRefreshKey, setReportRefreshKey] = useState(0); // Для принудительного обновления отчетов

  // Данные для редактирования
  const [mealsList, setMealsList] = useState<any[]>([]);
  const [editingMeal, setEditingMeal] = useState<any | null>(null);
  const [refreshKey, setRefreshKey] = useState(0); // Для принудительного обновления

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

  const loadMealsForEdit = async (showLoading = true) => {
    if (!userId) return null;

    if (showLoading) {
      setLoading(true);
    }
    
    try {
      // Добавляем timestamp для предотвращения кеширования
      const response = await fetch(`/api/meals?userId=${userId}&_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      const data = await response.json();
      if (data.error) {
        setError(data.error);
        return null;
      } else {
        const meals = data.meals || [];
        // Принудительно обновляем список - создаем новый массив для гарантии обновления React
        // Сортируем по дате (новые сверху) - на всякий случай, хотя API уже сортирует
        const sortedMeals = [...meals].sort((a, b) => {
          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          return dateB - dateA; // Новые сверху
        });
        setMealsList(sortedMeals);
        // Принудительно обновляем refreshKey для гарантии ре-рендера
        setRefreshKey(prev => prev + 1);
        return sortedMeals;
      }
    } catch (err) {
      console.error("[loadMealsForEdit] Ошибка:", err);
      setError("Ошибка загрузки данных");
      return null;
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  // Функция для конвертации локального времени в UTC для запроса к API
  // localDate - это Date объект с локальным временем (например, 2024-01-01 00:00:00 MSK)
  // Нужно получить UTC эквивалент для этого локального времени
  const localToUTC = (localDate: Date): Date => {
    // localDate уже содержит локальное время
    // getTime() возвращает timestamp в миллисекундах (UTC)
    // Но нам нужно создать Date объект, который при toISOString() даст правильное UTC время
    // Просто используем localDate как есть - JavaScript автоматически конвертирует при toISOString()
    return localDate;
  };

  const generateReportForPeriod = async (period: "today" | "week" | "month" | "year") => {
    if (!userId) {
      setError("Пользователь не найден");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Получаем дневную норму пользователя
      const userResponse = await fetch(`/api/user?userId=${userId}`);
      const userData = await userResponse.json();
      if (userData.calories) {
        setDailyNorm(userData.calories);
      }

      const now = new Date();
      let localStart: Date;
      let localEnd: Date;

      // Работаем с локальным временем пользователя
      switch (period) {
        case "today":
          localStart = new Date(now);
          localStart.setHours(0, 0, 0, 0);
          localEnd = new Date(now);
          localEnd.setHours(23, 59, 59, 999);
          break;
        case "week":
          // Последние 7 дней (включая сегодня)
          localEnd = new Date(now);
          localEnd.setHours(23, 59, 59, 999);
          localStart = new Date(now);
          localStart.setDate(localStart.getDate() - 6); // 7 дней назад (включая сегодня)
          localStart.setHours(0, 0, 0, 0);
          break;
        case "month":
          // Последние 30 дней (включая сегодня)
          localEnd = new Date(now);
          localEnd.setHours(23, 59, 59, 999);
          localStart = new Date(now);
          localStart.setDate(localStart.getDate() - 29); // 30 дней назад (включая сегодня)
          localStart.setHours(0, 0, 0, 0);
          break;
        case "year":
          // Последние 365 дней (включая сегодня)
          localEnd = new Date(now);
          localEnd.setHours(23, 59, 59, 999);
          localStart = new Date(now);
          localStart.setDate(localStart.getDate() - 364); // 365 дней назад (включая сегодня)
          localStart.setHours(0, 0, 0, 0);
          break;
      }
      
      // Конвертируем локальное время в UTC для запроса
      const startUTC = localToUTC(localStart);
      const endUTC = localToUTC(localEnd);
      
      // Запрос к API
      const response = await fetch(
        `/api/report?userId=${userId}&start=${startUTC.toISOString()}&end=${endUTC.toISOString()}&_t=${Date.now()}`,
        {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        }
      );
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        // Фильтруем данные по локальному времени на клиенте
        const filteredMeals = (data.meals || []).filter((meal: any) => {
          const mealDateUTC = new Date(meal.created_at);
          // Сравниваем timestamp напрямую
          const mealTimestamp = mealDateUTC.getTime();
          const startTimestamp = localStart.getTime();
          const endTimestamp = localEnd.getTime();
          return mealTimestamp >= startTimestamp && mealTimestamp <= endTimestamp;
        });
        
        // Пересчитываем итоги для отфильтрованных данных
        const filteredTotals = filteredMeals.reduce(
          (acc: any, meal: any) => ({
            calories: acc.calories + Number(meal.calories || 0),
            protein: acc.protein + Number(meal.protein || 0),
            fat: acc.fat + Number(meal.fat || 0),
            carbs: acc.carbs + Number(meal.carbs || 0)
          }),
          { calories: 0, protein: 0, fat: 0, carbs: 0 }
        );
        
        setReportData(filteredMeals);
        setReportTotals(filteredTotals);
        setReportPeriod(period);
        setReportRefreshKey(prev => prev + 1);
        setView("report");
      }
    } catch (err) {
      setError("Ошибка генерации отчета");
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
    setError(null);
    try {
      // Получаем локальное время начала и конца дня
      const localStart = new Date(reportStartDate);
      localStart.setHours(0, 0, 0, 0);
      const localEnd = new Date(reportEndDate);
      localEnd.setHours(23, 59, 59, 999);
      
      // Конвертируем локальное время в UTC для запроса
      const startUTC = localToUTC(localStart);
      const endUTC = localToUTC(localEnd);
      
      // Получаем дневную норму пользователя
      const userResponse = await fetch(`/api/user?userId=${userId}`);
      const userData = await userResponse.json();
      if (userData.calories) {
        setDailyNorm(userData.calories);
      }

      // Запрос к API
      const response = await fetch(
        `/api/report?userId=${userId}&start=${startUTC.toISOString()}&end=${endUTC.toISOString()}&_t=${Date.now()}`,
        {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        }
      );
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        // Фильтруем данные по локальному времени на клиенте
        const filteredMeals = (data.meals || []).filter((meal: any) => {
          const mealDateUTC = new Date(meal.created_at);
          // Сравниваем timestamp напрямую
          const mealTimestamp = mealDateUTC.getTime();
          const startTimestamp = localStart.getTime();
          const endTimestamp = localEnd.getTime();
          return mealTimestamp >= startTimestamp && mealTimestamp <= endTimestamp;
        });
        
        // Пересчитываем итоги для отфильтрованных данных
        const filteredTotals = filteredMeals.reduce(
          (acc: any, meal: any) => ({
            calories: acc.calories + Number(meal.calories || 0),
            protein: acc.protein + Number(meal.protein || 0),
            fat: acc.fat + Number(meal.fat || 0),
            carbs: acc.carbs + Number(meal.carbs || 0)
          }),
          { calories: 0, protein: 0, fat: 0, carbs: 0 }
        );
        
        setReportData(filteredMeals);
        setReportTotals(filteredTotals);
        setReportPeriod("custom");
        setReportRefreshKey(prev => prev + 1);
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
    setError(null);
    try {
      const response = await fetch(`/api/meals/${mealId}`, {
        method: "DELETE"
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.ok) {
        const errorMsg = data.error || "Ошибка удаления";
        setError(errorMsg);
        return;
      }

      // Успешно удалено
      setEditingMeal(null);
      
      // Сразу удаляем из списка для мгновенного обновления UI
      setMealsList(prevMeals => {
        const filtered = prevMeals.filter(meal => meal.id !== mealId);
        return [...filtered]; // Создаем новый массив
      });
      
      // Принудительно обновляем refreshKey
      setRefreshKey(prev => prev + 1);
      
      // Затем перезагружаем с сервера для синхронизации
      await loadMealsForEdit(false);
    } catch (err: any) {
      setError(err.message || "Ошибка удаления");
    } finally {
      setLoading(false);
    }
  };

  const updateMeal = async (mealId: number, updates: any) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/meals/${mealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      });
      const data = await response.json();
      
      if (!response.ok || !data.ok) {
        const errorMsg = data.error || "Ошибка обновления";
        setError(errorMsg);
        return;
      }

      // Успешно обновлено
      setEditingMeal(null);
      
      // Принудительно обновляем refreshKey
      setRefreshKey(prev => prev + 1);
      
      // Перезагружаем список с сервера
      await loadMealsForEdit(false);
    } catch (err: any) {
      console.error("[updateMeal] Исключение:", err);
      setError(err.message || "Ошибка обновления");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (view === "edit") {
      // Загружаем сразу
      loadMealsForEdit();
      
      // Обновляем при фокусе на окне (когда пользователь возвращается в редактор)
      const handleFocus = () => {
        loadMealsForEdit(false);
      };
      
      const handleVisibilityChange = () => {
        if (!document.hidden) {
          loadMealsForEdit(false);
        }
      };
      
      window.addEventListener("focus", handleFocus);
      document.addEventListener("visibilitychange", handleVisibilityChange);
      
      return () => {
        window.removeEventListener("focus", handleFocus);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      };
    } else if (view === "report" && reportPeriod) {
      // Обновляем при фокусе на окне
      const refreshReport = () => {
        if (reportPeriod === "custom" && reportStartDate && reportEndDate) {
          generateReport();
        } else if (reportPeriod !== "custom") {
          generateReportForPeriod(reportPeriod);
        }
      };
      
      const handleFocus = () => {
        refreshReport();
      };
      
      const handleVisibilityChange = () => {
        if (!document.hidden) {
          refreshReport();
        }
      };
      
      window.addEventListener("focus", handleFocus);
      document.addEventListener("visibilitychange", handleVisibilityChange);
      
      return () => {
        window.removeEventListener("focus", handleFocus);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, userId, reportPeriod, reportStartDate, reportEndDate]);

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

  // Главное меню (только для отчета)
  if (view === "menu") {
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
              onClick={() => generateReportForPeriod("today")}
              className="w-full py-4 px-6 bg-accent text-white font-semibold rounded-xl shadow-soft hover:opacity-90 transition-opacity"
            >
              Сегодня
            </button>

            <button
              onClick={() => generateReportForPeriod("week")}
              className="w-full py-4 px-6 bg-accent text-white font-semibold rounded-xl shadow-soft hover:opacity-90 transition-opacity"
            >
              Неделю
            </button>

            <button
              onClick={() => generateReportForPeriod("month")}
              className="w-full py-4 px-6 bg-accent text-white font-semibold rounded-xl shadow-soft hover:opacity-90 transition-opacity"
            >
              Месяц
            </button>

            <button
              onClick={() => generateReportForPeriod("year")}
              className="w-full py-4 px-6 bg-accent text-white font-semibold rounded-xl shadow-soft hover:opacity-90 transition-opacity"
            >
              Год
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
                  onClick={() => {
                    if (reportPeriod === "custom" && reportStartDate && reportEndDate) {
                      generateReport();
                    } else if (reportPeriod !== "custom") {
                      generateReportForPeriod(reportPeriod);
                    }
                  }}
                  disabled={loading}
                  className="px-3 py-1.5 text-sm bg-accent/20 text-accent font-medium rounded-lg hover:bg-accent/30 transition-colors disabled:opacity-50"
                  title="Обновить отчет"
                >
                  🔄
                </button>
              )}
              <button
                onClick={() => {
                  setView("menu");
                  setReportData(null);
                  setReportTotals(null);
                }}
                className="text-textSecondary hover:text-textPrimary"
              >
                ← Назад
              </button>
            </div>
          </div>

          {!reportData && (
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
                onClick={generateReport}
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

          {reportData && reportTotals && (
            <div className="mt-6 space-y-4">
              <div className="p-4 bg-accent/10 rounded-xl">
                <h3 className="font-semibold text-textPrimary mb-2">Итого за период:</h3>
                <div className="space-y-1 text-sm">
                  {dailyNorm && (
                    <div className="mb-2 pb-2 border-b border-gray-200">
                      {(() => {
                        let periodNorm = dailyNorm;
                        if (reportPeriod === "week") periodNorm = dailyNorm * 7;
                        else if (reportPeriod === "month") periodNorm = dailyNorm * 30;
                        else if (reportPeriod === "year") periodNorm = dailyNorm * 365;
                        else if (reportPeriod === "custom") {
                          // Для выбранного периода считаем количество дней
                          const start = new Date(reportStartDate);
                          const end = new Date(reportEndDate);
                          const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                          periodNorm = dailyNorm * days;
                        } else if (reportPeriod === "today") {
                          periodNorm = dailyNorm;
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

              <div className="space-y-3">
                <h3 className="font-semibold text-textPrimary">Приемы пищи:</h3>
                {reportData.length === 0 ? (
                  <div className="text-center text-textSecondary py-8">
                    Нет записей за выбранный период
                  </div>
                ) : (
                  reportData.map((meal, index) => {
                    // Конвертируем UTC из базы в локальное время для отображения
                    const mealDateUTC = new Date(meal.created_at);
                    // Создаем дату в локальном времени
                    const mealDate = new Date(mealDateUTC.getTime() - mealDateUTC.getTimezoneOffset() * 60000);
                    
                    const dayNames = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
                    const dayName = dayNames[mealDate.getDay()];
                    const formattedDate = mealDate.toLocaleDateString("ru-RU", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric"
                    });
                    
                    // Проверяем, нужно ли показывать дату (если это первая запись или дата отличается от предыдущей)
                    const prevMeal = index > 0 ? reportData[index - 1] : null;
                    let showDate = true;
                    if (prevMeal) {
                      const prevDateUTC = new Date(prevMeal.created_at);
                      const prevDate = new Date(prevDateUTC.getTime() - prevDateUTC.getTimezoneOffset() * 60000);
                      // Сравниваем только дату (без времени)
                      showDate = mealDate.toDateString() !== prevDate.toDateString();
                    }
                    
                    const mealKey = `${meal.id}-${reportRefreshKey}-${index}`;
                    
                    return (
                      <div key={mealKey}>
                        {showDate && (
                          <div className="text-lg font-bold text-textPrimary mb-3 mt-6 first:mt-0 py-2 px-3 bg-accent/15 rounded-lg border-l-4 border-accent">
                            🗓️ {formattedDate} {dayName}
                          </div>
                        )}
                        <div className="p-4 border border-gray-200 rounded-xl">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="font-medium text-textPrimary">{meal.meal_text}</div>
                              <div className="text-xs text-textSecondary">
                                {mealDate.toLocaleTimeString("ru-RU", {
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
                      </div>
                    );
                  })
                )}
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
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  loadMealsForEdit();
                }}
                disabled={loading}
                className="px-3 py-1.5 text-sm bg-accent/20 text-accent font-medium rounded-lg hover:bg-accent/30 transition-colors disabled:opacity-50"
                title="Обновить список"
              >
                🔄
              </button>
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
                mealsList.map((meal, index) => {
                  // Конвертируем UTC из базы в локальное время для отображения (как в отчетах)
                  const mealDateUTC = new Date(meal.created_at);
                  // Создаем дату в локальном времени
                  const mealDate = new Date(mealDateUTC.getTime() - mealDateUTC.getTimezoneOffset() * 60000);
                  
                  const dayNames = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
                  const dayName = dayNames[mealDate.getDay()];
                  const formattedDate = mealDate.toLocaleDateString("ru-RU", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric"
                  });
                  
                  // Проверяем, нужно ли показывать дату (если это первая запись или дата отличается от предыдущей)
                  const prevMeal = index > 0 ? mealsList[index - 1] : null;
                  let showDate = true;
                  if (prevMeal) {
                    const prevDateUTC = new Date(prevMeal.created_at);
                    const prevDate = new Date(prevDateUTC.getTime() - prevDateUTC.getTimezoneOffset() * 60000);
                    // Сравниваем только дату (без времени)
                    showDate = mealDate.toDateString() !== prevDate.toDateString();
                  }
                  
                  // Используем refreshKey для принудительного обновления
                  const mealKey = `${meal.id}-${refreshKey}-${index}`;
                  
                  return (
                    <div key={mealKey}>
                      {showDate && (
                        <div className="text-lg font-bold text-textPrimary mb-3 mt-6 first:mt-0 py-2 px-3 bg-accent/15 rounded-lg border-l-4 border-accent">
                          🗓️ {formattedDate} {dayName}
                        </div>
                      )}
                      <div
                        className="p-4 border border-gray-200 rounded-xl hover:border-accent transition-colors cursor-pointer"
                        onClick={() => setEditingMeal(meal)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-medium text-textPrimary mb-1">{meal.meal_text}</div>
                            <div className="text-xs text-textSecondary mb-2">
                              {mealDate.toLocaleTimeString("ru-RU", {
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
    console.log("[EditMealForm] handleSave вызван, данные:", {
      meal_text: mealText,
      calories: Number(calories),
      protein: Number(protein),
      fat: Number(fat),
      carbs: Number(carbs)
    });
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

export default function StatsPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <StatsPageContent />
    </Suspense>
  );
}


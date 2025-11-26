"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
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

interface DayReport {
  date: string;
  totals: {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
  };
  dailyNorm: number;
  percentage: number;
  meals: Meal[];
  mealsCount: number;
}

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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Календарь
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [datesWithData, setDatesWithData] = useState<string[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);

  // Отчёт за день
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayReport, setDayReport] = useState<DayReport | null>(null);
  const [loadingDayReport, setLoadingDayReport] = useState(false);

  // Редактирование
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

  // Загрузка календаря при изменении месяца
  useEffect(() => {
    if (userId) {
      loadCalendar();
    }
  }, [userId, currentMonth]);

  /**
   * Загружает календарь (даты с данными)
   */
  const loadCalendar = async () => {
    if (!userId) return;

    setLoadingCalendar(true);
    try {
      const monthStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
      const response = await fetch(
        `/api/report/calendar?userId=${userId}&month=${monthStr}`,
        {
          method: 'GET',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        }
      );

      const data = await response.json();

      if (!data.ok) {
        console.error("[loadCalendar] Ошибка:", data.error);
        setDatesWithData([]);
        return;
      }

      setDatesWithData(data.dates || []);
    } catch (err: any) {
      console.error("[loadCalendar] Ошибка:", err);
      setDatesWithData([]);
    } finally {
      setLoadingCalendar(false);
    }
  };

  /**
   * Загружает отчёт за день
   */
  const loadDayReport = async (date: string) => {
    if (!userId) return;

    setSelectedDate(date);
    setLoadingDayReport(true);
    setDayReport(null);

    try {
      const response = await fetch(
        `/api/report/day?userId=${userId}&date=${date}`,
        {
          method: 'GET',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        }
      );

      const data = await response.json();

      if (!data.ok) {
        setError(data.error || "Ошибка загрузки отчёта");
        setDayReport(null);
        return;
      }

      setDayReport(data.report);
    } catch (err: any) {
      setError(err.message || "Ошибка загрузки отчёта");
      setDayReport(null);
    } finally {
      setLoadingDayReport(false);
    }
  };

  /**
   * Обновляет приём пищи
   */
  const updateMeal = async (mealId: number, updates: Partial<Meal>) => {
    if (!userId || !selectedDate) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/meal/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: mealId,
          ...updates
        }),
        cache: 'no-store'
      });

      const data = await response.json();

      if (!data.ok) {
        setError(data.error || "Ошибка обновления");
        return;
      }

      // Закрываем форму
      setEditingMeal(null);

      // ВСЕГДА перезагружаем отчёт с сервера
      await new Promise(resolve => setTimeout(resolve, 500));
      await loadDayReport(selectedDate);
      await loadCalendar(); // Обновляем календарь тоже
    } catch (err: any) {
      setError(err.message || "Ошибка обновления");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Удаляет приём пищи
   */
  const deleteMeal = async (mealId: number) => {
    if (!confirm("Удалить этот приём пищи?")) return;
    if (!userId || !selectedDate) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/meal/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: mealId }),
        cache: 'no-store'
      });

      const data = await response.json();

      if (!data.ok) {
        setError(data.error || "Ошибка удаления");
        return;
      }

      // Закрываем форму
      setEditingMeal(null);

      // ВСЕГДА перезагружаем отчёт с сервера
      await new Promise(resolve => setTimeout(resolve, 500));
      await loadDayReport(selectedDate);
      await loadCalendar(); // Обновляем календарь тоже
    } catch (err: any) {
      setError(err.message || "Ошибка удаления");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Переключение месяца
   */
  const changeMonth = (delta: number) => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + delta);
    setCurrentMonth(newMonth);
  };

  /**
   * Генерация календаря
   */
  const getCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    // Первый день месяца
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // День недели первого дня (0 = воскресенье, 1 = понедельник, ...)
    const startDay = firstDay.getDay();
    
    // Количество дней в месяце
    const daysInMonth = lastDay.getDate();

    const days: (number | null)[] = [];

    // Пустые ячейки до первого дня
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }

    // Дни месяца
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    return days;
  };

  /**
   * Форматирование даты для проверки
   */
  const getDateKey = (day: number): string => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

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

  // Модальное окно с отчётом за день
  if (selectedDate && (dayReport || loadingDayReport)) {
    return (
      <div className="min-h-screen bg-background p-4 py-8">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-soft p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-textPrimary">
              📋 Отчёт за {new Date(selectedDate).toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
                year: "numeric"
              })}
            </h2>
            <button
              onClick={() => {
                setSelectedDate(null);
                setDayReport(null);
                setEditingMeal(null);
              }}
              className="text-textSecondary hover:text-textPrimary"
            >
              ← Назад
            </button>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">
              {error}
            </div>
          )}

          {loadingDayReport ? (
            <div className="text-center text-textSecondary py-8">Загрузка...</div>
          ) : dayReport ? (
            <>
              {editingMeal ? (
                <EditMealForm
                  meal={editingMeal}
                  onSave={(updates) => updateMeal(editingMeal.id, updates)}
                  onCancel={() => setEditingMeal(null)}
                  onDelete={() => deleteMeal(editingMeal.id)}
                />
              ) : (
                <div className="space-y-4">
                  {/* Итоги за день */}
                  <div className="p-4 bg-accent/10 rounded-xl">
                    <h3 className="font-semibold text-textPrimary mb-2">Итого за день:</h3>
                    <div className="space-y-1 text-sm">
                      <div className="mb-2 pb-2 border-b border-gray-200">
                        <div className="font-medium">
                          🔥 {dayReport.totals.calories.toFixed(0)} / {dayReport.dailyNorm.toFixed(0)} ккал ({dayReport.percentage.toFixed(1)}%)
                        </div>
                      </div>
                      <div>🔥 {dayReport.totals.calories.toFixed(0)} ккал</div>
                      <div>🥚 {dayReport.totals.protein.toFixed(1)} г белков</div>
                      <div>🥥 {dayReport.totals.fat.toFixed(1)} г жиров</div>
                      <div>🍚 {dayReport.totals.carbs.toFixed(1)} г углеводов</div>
                    </div>
                  </div>

                  {/* Список приёмов пищи */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-textPrimary">Приемы пищи:</h3>
                    {dayReport.meals.length === 0 ? (
                      <div className="text-center text-textSecondary py-8">
                        Нет записей за этот день
                      </div>
                    ) : (
                      dayReport.meals.map((meal) => {
                        const mealDate = new Date(meal.created_at);
                        return (
                          <div key={meal.id} className="p-4 border border-gray-200 rounded-xl hover:border-accent transition-colors">
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
                      })
                    )}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    );
  }

  // Календарь
  return (
    <div className="min-h-screen bg-background p-4 py-8">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-soft p-8">
        <h1 className="text-2xl font-bold mb-6 text-textPrimary text-center">
          📅 Календарь отчётов
        </h1>

        {/* Переключение месяцев */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => changeMonth(-1)}
            disabled={loadingCalendar}
            className="px-4 py-2 bg-accent/20 text-accent font-medium rounded-lg hover:bg-accent/30 transition-colors disabled:opacity-50"
          >
            ←
          </button>
          <h2 className="text-lg font-semibold text-textPrimary">
            {currentMonth.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}
          </h2>
          <button
            onClick={() => changeMonth(1)}
            disabled={loadingCalendar}
            className="px-4 py-2 bg-accent/20 text-accent font-medium rounded-lg hover:bg-accent/30 transition-colors disabled:opacity-50"
          >
            →
          </button>
        </div>

        {/* Календарь */}
        <div className="mb-4">
          <div className="grid grid-cols-7 gap-2 mb-2">
            {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
              <div key={day} className="text-center text-sm font-medium text-textSecondary py-2">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {getCalendarDays().map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} className="aspect-square" />;
              }

              const dateKey = getDateKey(day);
              const hasData = datesWithData.includes(dateKey);
              const isToday = dateKey === new Date().toISOString().split("T")[0];

              return (
                <button
                  key={day}
                  onClick={() => loadDayReport(dateKey)}
                  className={`
                    aspect-square rounded-lg font-medium text-sm transition-colors
                    ${hasData 
                      ? 'bg-accent text-white hover:bg-accent/90' 
                      : 'bg-gray-100 text-textPrimary hover:bg-gray-200'
                    }
                    ${isToday ? 'ring-2 ring-accent ring-offset-2' : ''}
                  `}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        {loadingCalendar && (
          <div className="text-center text-textSecondary text-sm py-2">
            Загрузка...
          </div>
        )}

        <div className="mt-6 text-center text-sm text-textSecondary">
          Нажмите на день, чтобы посмотреть отчёт
        </div>
      </div>
    </div>
  );
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


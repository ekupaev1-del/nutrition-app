"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./globals.css";

// Клиентский компонент с пошаговой формой
export function QuestionnaireFormContent() {
  const searchParams = useSearchParams();
  const userIdParam = searchParams.get("id");

  const [userId, setUserId] = useState<number | null>(null);
  const [step, setStep] = useState(0); // 0 = приветствие, 1-6 = шаги, 7 = результаты
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Форма данные
  const [gender, setGender] = useState<string>("");
  const [age, setAge] = useState<string>("");
  const [weight, setWeight] = useState<string>("");
  const [height, setHeight] = useState<string>("");
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

  // Автопереход после выбора пола
  useEffect(() => {
    if (step === 1 && gender) {
      const timer = setTimeout(() => setStep(2), 500);
      return () => clearTimeout(timer);
    }
  }, [step, gender]);

  // Автопереход после ввода возраста
  useEffect(() => {
    if (step === 2 && age && Number(age) > 0) {
      const timer = setTimeout(() => setStep(3), 800);
      return () => clearTimeout(timer);
    }
  }, [step, age]);

  // Автопереход после ввода веса
  useEffect(() => {
    if (step === 3 && weight && Number(weight) > 0) {
      const timer = setTimeout(() => setStep(4), 800);
      return () => clearTimeout(timer);
    }
  }, [step, weight]);

  // Автопереход после ввода роста
  useEffect(() => {
    if (step === 4 && height && Number(height) > 0) {
      const timer = setTimeout(() => setStep(5), 800);
      return () => clearTimeout(timer);
    }
  }, [step, height]);

  // Автопереход после выбора цели
  useEffect(() => {
    if (step === 5 && goal) {
      const timer = setTimeout(() => {
        calculateMacros();
        setStep(6);
      }, 500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, goal]);

  // Автоматическое сохранение при появлении результатов
  useEffect(() => {
    if (step === 6 && calories && protein && fat && carbs && !saved && !loading) {
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, calories, protein, fat, carbs, saved, loading]);

  const calculateMacros = useCallback(() => {
    if (!gender || !age || !weight || !height || !goal) return;

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

    // Используем умеренную активность по умолчанию (1.55)
    const multiplier = 1.55;
    let totalCalories = bmr * multiplier;

    // Корректировка по цели
    const goalMultipliers: Record<string, number> = {
      lose: 0.85,
      maintain: 1.0,
      gain: 1.15
    };

    const goalMultiplier = goalMultipliers[goal] || 1.0;
    totalCalories = Math.round(totalCalories * goalMultiplier);

    // Макроэлементы
    const proteinGrams = Math.round(weightNum * 2.2);
    const proteinCalories = proteinGrams * 4;

    const fatCalories = Math.round(totalCalories * 0.25);
    const fatGrams = Math.round(fatCalories / 9);

    const carbsCalories = totalCalories - proteinCalories - fatCalories;
    const carbsGrams = Math.round(carbsCalories / 4);

    setCalories(totalCalories);
    setProtein(proteinGrams);
    setFat(fatGrams);
    setCarbs(carbsGrams);
  }, [gender, age, weight, height, goal]);

  const handleSubmit = async () => {
    if (!userId || !calories || !protein || !fat || !carbs || saved) {
      return;
    }

    setLoading(true);
    setError(null);

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
          activity: "moderate", // Дефолтная активность
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
        setLoading(false);
        return;
      }

      setSaved(true);
      setLoading(false);
    } catch (err) {
      console.error("Ошибка отправки формы:", err);
      setError("Не удалось отправить данные. Попробуйте позже.");
      setLoading(false);
    }
  };

  const handleBackToBot = () => {
    // Закрываем Telegram WebApp
    if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
      (window as any).Telegram.WebApp.close();
    } else {
      // Fallback - просто закрываем окно/вкладку
      window.close();
    }
  };

  if (error && !userId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-2xl shadow-xl p-6 text-center"
        >
          <h2 className="text-xl font-semibold mb-2 text-red-600">Ошибка</h2>
          <p className="text-gray-700">{error}</p>
          <p className="text-sm text-gray-500 mt-4">Запустите анкету через Telegram бота</p>
        </motion.div>
      </div>
    );
  }

  // Экран 1: Приветствие
  if (step === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-md w-full text-center px-6"
        >
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-sm text-gray-500 mb-4 font-light"
          >
            Твой дневник питания
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-3xl md:text-4xl font-bold mb-4 text-gray-800 leading-tight"
          >
            Считаем, сколько калорий вам нужно в день
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-lg text-gray-600 mb-10"
          >
            Просто ответьте на пару вопросов
          </motion.p>
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, type: "spring" }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setStep(1)}
            className="w-full py-4 px-6 bg-green-600 text-white font-semibold rounded-xl shadow-lg hover:bg-green-700 transition-colors text-lg"
          >
            Начать
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // Экран 7: Результаты
  if (step === 6) {
    return (
      <div className="min-h-screen bg-background p-4 py-8">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h2 className="text-3xl font-bold mb-2 text-gray-800">Ваша норма в день</h2>
          </motion.div>

          <AnimatePresence>
            {calories && protein && fat && carbs && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-2xl shadow-xl p-6 md:p-8 space-y-6"
              >
                <div className="grid grid-cols-2 gap-4">
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="p-5 bg-green-50 rounded-xl border-2 border-green-200"
                  >
                    <div className="text-sm text-gray-600 mb-1">Калории</div>
                    <div className="text-3xl font-bold text-green-700">{calories}</div>
                    <div className="text-xs text-gray-500 mt-1">ккал</div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                    className="p-5 bg-blue-50 rounded-xl border-2 border-blue-200"
                  >
                    <div className="text-sm text-gray-600 mb-1">Белки</div>
                    <div className="text-3xl font-bold text-blue-700">{protein}</div>
                    <div className="text-xs text-gray-500 mt-1">г</div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    className="p-5 bg-orange-50 rounded-xl border-2 border-orange-200"
                  >
                    <div className="text-sm text-gray-600 mb-1">Жиры</div>
                    <div className="text-3xl font-bold text-orange-700">{fat}</div>
                    <div className="text-xs text-gray-500 mt-1">г</div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 }}
                    className="p-5 bg-purple-50 rounded-xl border-2 border-purple-200"
                  >
                    <div className="text-sm text-gray-600 mb-1">Углеводы</div>
                    <div className="text-3xl font-bold text-purple-700">{carbs}</div>
                    <div className="text-xs text-gray-500 mt-1">г</div>
                  </motion.div>
                </div>

                {loading && (
                  <div className="text-center text-gray-500 text-sm py-2">
                    Сохранение...
                  </div>
                )}

                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}

                {saved && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm text-center"
                  >
                    ✅ Данные сохранены
                  </motion.div>
                )}

                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleBackToBot}
                  className="w-full py-4 px-6 bg-green-600 text-white font-semibold rounded-xl shadow-lg hover:bg-green-700 transition-colors"
                >
                  Вернуться в бота
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // Шаги вопросов (2-6)
  const steps = [
    {
      step: 1,
      title: "Выберите пол",
      content: (
        <div className="space-y-4">
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setGender("male")}
            className={`w-full text-left p-5 rounded-xl border-2 transition-all ${
              gender === "male"
                ? "border-green-500 bg-green-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <span className="text-2xl mr-3">👨</span>
            <span className="text-lg font-semibold text-gray-800">Мужской</span>
          </motion.button>
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setGender("female")}
            className={`w-full text-left p-5 rounded-xl border-2 transition-all ${
              gender === "female"
                ? "border-green-500 bg-green-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <span className="text-2xl mr-3">👩</span>
            <span className="text-lg font-semibold text-gray-800">Женский</span>
          </motion.button>
        </div>
      )
    },
    {
      step: 2,
      title: "Сколько вам лет?",
      content: (
        <motion.input
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          type="number"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          placeholder="27"
          min="1"
          max="120"
          autoFocus
          className="w-full px-6 py-5 text-2xl font-semibold text-center border-2 border-gray-200 rounded-xl focus:outline-none focus:border-green-500 transition-colors bg-white text-gray-800 placeholder:text-gray-400"
        />
      )
    },
    {
      step: 3,
      title: "Сколько вы весите?",
      content: (
        <motion.input
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          type="number"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="93"
          min="1"
          step="0.1"
          autoFocus
          className="w-full px-6 py-5 text-2xl font-semibold text-center border-2 border-gray-200 rounded-xl focus:outline-none focus:border-green-500 transition-colors bg-white text-gray-800 placeholder:text-gray-400"
        />
      )
    },
    {
      step: 4,
      title: "Какой у вас рост?",
      content: (
        <motion.input
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          type="number"
          value={height}
          onChange={(e) => setHeight(e.target.value)}
          placeholder="183"
          min="1"
          autoFocus
          className="w-full px-6 py-5 text-2xl font-semibold text-center border-2 border-gray-200 rounded-xl focus:outline-none focus:border-green-500 transition-colors bg-white text-gray-800 placeholder:text-gray-400"
        />
      )
    },
    {
      step: 5,
      title: "Какая у вас цель?",
      content: (
        <div className="space-y-4">
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setGoal("lose")}
            className={`w-full text-left p-5 rounded-xl border-2 transition-all ${
              goal === "lose"
                ? "border-green-500 bg-green-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <span className="text-2xl mr-3">🔥</span>
            <span className="text-lg font-semibold text-gray-800">Похудеть</span>
          </motion.button>
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setGoal("gain")}
            className={`w-full text-left p-5 rounded-xl border-2 transition-all ${
              goal === "gain"
                ? "border-green-500 bg-green-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <span className="text-2xl mr-3">💪</span>
            <span className="text-lg font-semibold text-gray-800">Набрать</span>
          </motion.button>
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setGoal("maintain")}
            className={`w-full text-left p-5 rounded-xl border-2 transition-all ${
              goal === "maintain"
                ? "border-green-500 bg-green-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <span className="text-2xl mr-3">👌</span>
            <span className="text-lg font-semibold text-gray-800">Поддерживать</span>
          </motion.button>
        </div>
      )
    }
  ];

  const currentStepData = steps[step - 1];
  const totalSteps = 5;

  return (
    <div className="min-h-screen bg-background p-4 py-8">
      <div className="max-w-xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-2xl shadow-xl p-6 md:p-8"
          >
            <h2 className="text-2xl md:text-3xl font-bold mb-8 text-gray-800 text-center">
              {currentStepData.title}
            </h2>

            <div className="mb-8">
              {currentStepData.content}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

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
  }, [gender, age, weight, height, activity, goal]);

  const handleNext = () => {
    if (step === 0) {
      setStep(1);
    } else if (step === 1 && gender) {
      setStep(2);
    } else if (step === 2 && age) {
      setStep(3);
    } else if (step === 3 && weight) {
      setStep(4);
    } else if (step === 4 && height) {
      setStep(5);
    } else if (step === 5 && activity) {
      setStep(6);
    } else if (step === 6 && goal) {
      calculateMacros();
      setStep(7);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    if (!userId || !calories || !protein || !fat || !carbs) {
      setError("Не удалось рассчитать нормы");
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
        setLoading(false);
        return;
      }

      // Успешно сохранено - можно показать успех или остаться на экране результатов
      setLoading(false);
    } catch (err) {
      console.error("Ошибка отправки формы:", err);
      setError("Не удалось отправить данные. Попробуйте позже.");
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

  const totalSteps = 6;
  const progress = step === 0 ? 0 : ((step - 1) / totalSteps) * 100;

  // Приветственный экран
  if (step === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-md w-full text-center"
        >
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="mb-8"
          >
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
              <span className="text-4xl">✨</span>
            </div>
          </motion.div>
          <h1 className="text-4xl font-bold mb-4 text-gray-800">
            Мой путь к балансу
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Давайте рассчитаем вашу персональную дневную норму калорий и макроэлементов
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleNext}
            className="w-full py-4 px-6 bg-green-600 text-white font-semibold rounded-lg shadow-lg hover:bg-green-700 transition-colors"
          >
            Начать анкету
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // Экран результатов
  if (step === 7) {
    return (
      <div className="min-h-screen bg-background p-4 py-8">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h2 className="text-3xl font-bold mb-2">Ваша дневная норма</h2>
            <p className="text-gray-600">Рассчитано специально для вас</p>
          </motion.div>

          <AnimatePresence>
            {calories && protein && fat && carbs && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-2xl shadow-xl p-8 space-y-6"
              >
                <div className="grid grid-cols-2 gap-6">
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="p-6 bg-green-50 rounded-xl border-2 border-green-200"
                  >
                    <div className="text-sm text-gray-600 mb-1">Калории</div>
                    <div className="text-3xl font-bold text-green-700">{calories}</div>
                    <div className="text-sm text-gray-500 mt-1">ккал/день</div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                    className="p-6 bg-blue-50 rounded-xl border-2 border-blue-200"
                  >
                    <div className="text-sm text-gray-600 mb-1">Белки</div>
                    <div className="text-3xl font-bold text-blue-700">{protein}</div>
                    <div className="text-sm text-gray-500 mt-1">г/день</div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    className="p-6 bg-orange-50 rounded-xl border-2 border-orange-200"
                  >
                    <div className="text-sm text-gray-600 mb-1">Жиры</div>
                    <div className="text-3xl font-bold text-orange-700">{fat}</div>
                    <div className="text-sm text-gray-500 mt-1">г/день</div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 }}
                    className="p-6 bg-purple-50 rounded-xl border-2 border-purple-200"
                  >
                    <div className="text-sm text-gray-600 mb-1">Углеводы</div>
                    <div className="text-3xl font-bold text-purple-700">{carbs}</div>
                    <div className="text-sm text-gray-500 mt-1">г/день</div>
                  </motion.div>
                </div>

                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full py-4 px-6 bg-green-600 text-white font-semibold rounded-lg shadow-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Сохранение..." : "Сохранить результаты"}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // Шаги вопросов
  const questions = [
    {
      question: "Укажите ваш пол",
      options: [
        { value: "male", label: "Мужской" },
        { value: "female", label: "Женский" }
      ],
      current: gender,
      setCurrent: setGender
    },
    {
      question: "Сколько вам лет?",
      type: "number",
      placeholder: "Введите ваш возраст",
      current: age,
      setCurrent: setAge,
      min: 1,
      max: 120
    },
    {
      question: "Какой у вас вес?",
      type: "number",
      placeholder: "Введите вес в килограммах",
      current: weight,
      setCurrent: setWeight,
      min: 1,
      step: 0.1,
      unit: "кг"
    },
    {
      question: "Какой у вас рост?",
      type: "number",
      placeholder: "Введите рост в сантиметрах",
      current: height,
      setCurrent: setHeight,
      min: 1,
      unit: "см"
    },
    {
      question: "Какой у вас уровень активности?",
      options: [
        { value: "sedentary", label: "Малоподвижный", desc: "Сидячая работа, мало спорта" },
        { value: "light", label: "Лёгкая активность", desc: "Тренировки 1-3 раза в неделю" },
        { value: "moderate", label: "Умеренная активность", desc: "Тренировки 3-5 раз в неделю" },
        { value: "active", label: "Высокая активность", desc: "Тренировки 6-7 раз в неделю" },
        { value: "very_active", label: "Очень высокая активность", desc: "Тренировки 2 раза в день" }
      ],
      current: activity,
      setCurrent: setActivity
    },
    {
      question: "Какую цель вы преследуете?",
      options: [
        { value: "lose", label: "Похудеть", desc: "Снизить вес" },
        { value: "maintain", label: "Поддерживать вес", desc: "Сохранить текущий вес" },
        { value: "gain", label: "Набрать вес", desc: "Увеличить мышечную массу" }
      ],
      current: goal,
      setCurrent: setGoal
    }
  ];

  const currentQuestion = questions[step - 1];
  const canProceed = currentQuestion.current && currentQuestion.current !== "";

  return (
    <div className="min-h-screen bg-background p-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Прогресс-бар */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Вопрос {step} из {totalSteps}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
              className="h-full bg-green-600 rounded-full"
            />
          </div>
        </div>

        {/* Вопрос */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-2xl shadow-xl p-8"
          >
            <h2 className="text-2xl font-bold mb-8 text-gray-800">
              {currentQuestion.question}
            </h2>

            {currentQuestion.options ? (
              <div className="space-y-3">
                {currentQuestion.options.map((option, idx) => (
                  <motion.button
                    key={option.value}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => currentQuestion.setCurrent(option.value)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      currentQuestion.current === option.value
                        ? "border-green-500 bg-green-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="font-semibold text-gray-800">{option.label}</div>
                    {"desc" in option && option.desc && (
                      <div className="text-sm text-gray-500 mt-1">{option.desc}</div>
                    )}
                  </motion.button>
                ))}
              </div>
            ) : (
              <motion.input
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                type={currentQuestion.type || "text"}
                value={currentQuestion.current || ""}
                onChange={(e) => currentQuestion.setCurrent(e.target.value)}
                placeholder={currentQuestion.placeholder}
                min={currentQuestion.min}
                max={currentQuestion.max}
                step={currentQuestion.step}
                className="w-full px-6 py-4 text-lg border-2 border-gray-200 rounded-lg focus:outline-none focus:border-green-500 transition-colors"
              />
            )}

            {/* Кнопки навигации */}
            <div className="flex gap-4 mt-8">
              {step > 1 && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleBack}
                  className="flex-1 py-3 px-6 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Назад
                </motion.button>
              )}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleNext}
                disabled={!canProceed}
                className="flex-1 py-3 px-6 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {step === totalSteps ? "Рассчитать" : "Далее"}
              </motion.button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

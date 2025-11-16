"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type Gender = "male" | "female";
type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
type Goal = "lose" | "gain" | "maintain";

type StepKey = "gender" | "age" | "height" | "weight" | "activity" | "goal";

type StepConfig = {
  key: StepKey;
  title: string;
  description?: string;
  emoji: string;
  inputType: "choice" | "number";
  options?: { value: string; label: string; emoji: string }[];
  unit?: string;
  placeholder?: string;
};

type FormValues = {
  gender: Gender | "";
  age: number | null;
  height: number | null;
  weight: number | null;
  activity: ActivityLevel | "";
  goal: Goal | "";
};

type ResultState = {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
} | null;

type CompletedFormValues = {
  gender: Gender;
  age: number;
  height: number;
  weight: number;
  activity: ActivityLevel;
  goal: Goal;
};

const isCompleteForm = (values: FormValues): values is CompletedFormValues => {
  return (
    values.gender !== "" &&
    values.goal !== "" &&
    values.activity !== "" &&
    values.age !== null &&
    values.height !== null &&
    values.weight !== null
  );
};

const steps: StepConfig[] = [
  {
    key: "gender",
    title: "Выберите свой пол",
    emoji: "👥",
    inputType: "choice",
    options: [
      { value: "male", label: "Мужчина", emoji: "👨" },
      { value: "female", label: "Женщина", emoji: "👩" }
    ]
  },
  {
    key: "age",
    title: "Сколько тебе лет?",
    emoji: "🎂",
    inputType: "number",
    placeholder: "Например, 28"
  },
  {
    key: "height",
    title: "Какой у тебя рост?",
    emoji: "📏",
    inputType: "number",
    unit: "см",
    placeholder: "Например, 180"
  },
  {
    key: "weight",
    title: "Сколько ты весишь?",
    emoji: "⚖️",
    inputType: "number",
    unit: "кг",
    placeholder: "Например, 82"
  },
  {
    key: "activity",
    title: "Какой у тебя уровень активности?",
    description: "Это помогает учесть тренировочные нагрузки.",
    emoji: "🏃",
    inputType: "choice",
    options: [
      { value: "sedentary", label: "Сидячая работа", emoji: "🪑" },
      { value: "light", label: "1–2 тренировки в неделю", emoji: "🚶" },
      { value: "moderate", label: "3–4 тренировки", emoji: "🏃" },
      { value: "active", label: "5+ тренировок", emoji: "🏋️" },
      { value: "very_active", label: "Спорт ежедневно", emoji: "🔥" }
    ]
  },
  {
    key: "goal",
    title: "Какая цель по весу?",
    emoji: "🎯",
    inputType: "choice",
    options: [
      { value: "lose", label: "Похудеть", emoji: "📉" },
      { value: "maintain", label: "Поддерживать", emoji: "⚖️" },
      { value: "gain", label: "Набрать", emoji: "📈" }
    ]
  }
];

const resultCardVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0 }
};

export default function HomePage() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [formValues, setFormValues] = useState<FormValues>({
    gender: "",
    age: null,
    height: null,
    weight: null,
    activity: "",
    goal: ""
  });
  const [numberValue, setNumberValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ResultState>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  const activeStepIndex = Math.min(currentStepIndex, steps.length - 1);
  const currentStep = steps[activeStepIndex];
  const isLastStep = activeStepIndex === steps.length - 1;

  const progressPercentage = useMemo(
    () => (result ? 100 : (activeStepIndex / (steps.length - 1)) * 100),
    [activeStepIndex, result]
  );

  useEffect(() => {
    if (result) {
      return;
    }

    if (currentStep.inputType === "number") {
      const storedValue = formValues[currentStep.key];
      if (typeof storedValue === "number") {
        setNumberValue(String(storedValue));
      } else {
        setNumberValue("");
      }
    } else {
      setNumberValue("");
    }
  }, [activeStepIndex, currentStep.inputType, currentStep.key, formValues, result]);

  const handleRestart = () => {
    setFormValues({ gender: "", age: null, height: null, weight: null, activity: "", goal: "" });
    setCurrentStepIndex(0);
    setResult(null);
    setErrorMessage(null);
    setNumberValue("");
    setHasStarted(false);
  };

  const handleBack = () => {
    if (result || activeStepIndex === 0) {
      return;
    }
    setErrorMessage(null);
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmitValue = async (value: string) => {
    setErrorMessage(null);

    const nextFormValues = { ...formValues };

    if (currentStep.inputType === "number") {
      const parsed = Number(value.replace(",", "."));
      if (Number.isNaN(parsed) || parsed <= 0) {
        setErrorMessage("Пожалуйста, введи значение чуть больше нуля.");
        return;
      }
      nextFormValues[currentStep.key] = parsed as never;
      setFormValues(nextFormValues);
    } else {
      nextFormValues[currentStep.key] = value as never;
      setFormValues(nextFormValues);
    }

    if (isLastStep) {
      await finalizeResults(nextFormValues as FormValues);
      return;
    }

    setCurrentStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const calculateMacros = (data: CompletedFormValues): ResultState => {
    const { gender, age, height, weight, goal, activity } = data;

    const activityMultiplier: Record<ActivityLevel, number> = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very_active: 1.9
    };

    const goalMultiplier = {
      lose: 0.85,
      maintain: 1,
      gain: 1.12
    };

    const s = gender === "male" ? 5 : -161;
    const bmr = 10 * weight + 6.25 * height - 5 * age + s;
    const maintenanceCalories = Math.round(bmr * activityMultiplier[activity]);

    const calories = Math.round(maintenanceCalories * goalMultiplier[goal]);
    const protein = Math.round((calories * 0.3) / 4);
    const fat = Math.round((calories * 0.25) / 9);
    const carbs = Math.round((calories * 0.45) / 4);

    return { calories, protein, fat, carbs };
  };

  const finalizeResults = async (values: FormValues) => {
    if (!isCompleteForm(values)) {
      setErrorMessage("Похоже, не хватает пары ответов. Проверь ещё раз.");
      return;
    }

    const calculated = calculateMacros(values);
    setResult(calculated);

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          gender: values.gender,
          age: values.age,
          height: values.height,
          weight: values.weight,
          activity: values.activity,
          goal: values.goal,
          ...calculated
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const message = data?.message ?? "Не получилось сохранить данные. Но расчёт уже готов.";
        setErrorMessage(message);
      }
    } catch (error) {
      setErrorMessage("Не удалось связаться с сервером. Проверь подключение и попробуй позже.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderChoiceStep = () => (
    <div className="grid gap-3">
      {currentStep.options?.map((option) => {
        const isActive = formValues[currentStep.key] === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => handleSubmitValue(option.value)}
            className={`flex items-center justify-between rounded-3xl border border-transparent bg-white/80 px-6 py-4 text-left shadow-soft transition duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/40 ${
              isActive ? "border-accent bg-accent/10" : "hover:translate-y-[-2px]"
            }`}
            disabled={isSubmitting}
          >
            <div className="flex items-center gap-4">
              <span className="text-3xl" aria-hidden>
                {option.emoji}
              </span>
              <div>
                <p className="text-lg font-semibold text-textPrimary">{option.label}</p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );

  const renderNumberStep = () => (
    <form
      className="flex w-full flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmitValue(numberValue);
      }}
    >
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          pattern="[0-9]*"
          min={0}
          step={currentStep.key === "age" ? 1 : 0.1}
          required
          value={numberValue}
          onChange={(event) => setNumberValue(event.target.value)}
          placeholder={currentStep.placeholder}
          className="w-full rounded-3xl border border-transparent bg-white/80 px-6 py-5 text-2xl font-semibold text-textPrimary shadow-soft outline-none transition focus:border-accent focus:bg-white"
        />
        {currentStep.unit ? (
          <span className="pointer-events-none absolute inset-y-0 right-6 flex items-center text-textSecondary">
            {currentStep.unit}
          </span>
        ) : null}
      </div>
      <button
        type="submit"
        className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-4 text-lg font-semibold text-white shadow-soft transition hover:bg-accent/90 disabled:bg-accentMuted disabled:text-white/70"
        disabled={isSubmitting}
      >
        Далее
        <span aria-hidden>→</span>
      </button>
    </form>
  );

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="relative flex w-full max-w-2xl flex-col items-stretch gap-8 rounded-[40px] bg-card/95 p-10 text-center shadow-soft backdrop-blur">
        <div className="flex flex-col items-center gap-3">
          <span className="text-sm font-semibold uppercase tracking-[0.3em] text-accentMuted">
            Твой дневник питания
          </span>
          <h1 className="text-3xl font-bold text-textPrimary md:text-4xl">
            Считаем, сколько калорий нужно в день
          </h1>
          {(!hasStarted && !result) && (
            <p className="max-w-xl text-base text-textSecondary">
              Просто ответьте на пару вопросов.
            </p>
          )}
        </div>

        {!hasStarted ? (
          <div className="flex flex-col items-center gap-6">
            <button
              type="button"
              onClick={() => {
                setHasStarted(true);
                setCurrentStepIndex(0);
                setResult(null);
                setErrorMessage(null);
                setNumberValue("");
              }}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-8 py-4 text-lg font-semibold text-white shadow-soft transition hover:bg-accent/90"
            >
              Начать!
            </button>
          </div>
        ) : result ? (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={resultCardVariants}
            className="space-y-6"
          >
            <div className="rounded-[32px] bg-white/90 p-8 shadow-soft">
              <div className="flex items-center justify-center gap-3 text-3xl">
                <span aria-hidden>🥗</span>
                <span className="text-2xl font-semibold text-textPrimary">Твоя норма в день</span>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-4">
                <SummaryCardValue label="Калории" value={result.calories} unit="ккал" emoji="🔥" />
                <SummaryCardValue label="Белки" value={result.protein} unit="г" emoji="🥚" />
                <SummaryCardValue label="Жиры" value={result.fat} unit="г" emoji="🥥" />
                <SummaryCardValue label="Углеводы" value={result.carbs} unit="г" emoji="🍚" />
              </div>
            </div>
            <button
              type="button"
              onClick={handleRestart}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-textPrimary px-6 py-4 text-lg font-semibold text-white transition hover:bg-textPrimary/90"
            >
              🔄 Начать заново
            </button>
            {errorMessage ? (
              <p className="text-sm text-red-500">{errorMessage}</p>
            ) : null}
          </motion.div>
        ) : (
          <div className="space-y-8">
            <div className="relative h-2 w-full rounded-full bg-accentMuted/20">
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-accent transition-all duration-500"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="flex flex-col items-center gap-6"
              >
                <div className="flex items-center gap-3 text-4xl">
                  <span aria-hidden>{currentStep.emoji}</span>
                  <h2 className="text-2xl font-semibold md:text-3xl">{currentStep.title}</h2>
                </div>
                {currentStep.description ? (
                  <p className="max-w-md text-base text-textSecondary">{currentStep.description}</p>
                ) : null}
                {currentStep.inputType === "choice" ? renderChoiceStep() : renderNumberStep()}
                {errorMessage ? <p className="text-sm text-red-500">{errorMessage}</p> : null}
                {activeStepIndex > 0 ? (
                  <button
                    type="button"
                    onClick={handleBack}
                    className="text-sm font-semibold text-textSecondary underline-offset-4 transition hover:text-textPrimary hover:underline"
                  >
                    ← Вернуться на шаг назад
                  </button>
                ) : null}
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>
    </main>
  );
}

type SummaryCardValueProps = {
  label: string;
  value: number;
  unit: string;
  emoji: string;
};

function SummaryCardValue({ label, value, unit, emoji }: SummaryCardValueProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl bg-background/60 p-4">
      <span className="text-2xl" aria-hidden>
        {emoji}
      </span>
      <p className="text-sm font-medium text-textSecondary">{label}</p>
      <p className="text-2xl font-semibold text-textPrimary">
        {value}
        <span className="ml-1 text-base font-medium text-textSecondary">{unit}</span>
      </p>
    </div>
  );
}

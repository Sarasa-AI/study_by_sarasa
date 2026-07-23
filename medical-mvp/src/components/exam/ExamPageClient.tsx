"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { ExamPlayer } from "@/components/exam/ExamPlayer";
import { startExamAction } from "@/lib/exam-actions";
import type { ExamCategoryOption, ExamQuizItem } from "@/lib/exam-service";

const QUESTION_COUNTS = [10, 20, 50] as const;
const TIME_PRESETS = [15, 30, 60] as const;

type ExamPageClientProps = {
  categories: ExamCategoryOption[];
};

type ActiveExam = {
  items: ExamQuizItem[];
  timeLimitMinutes: number;
  endsAt: number;
};

export function ExamPageClient({ categories }: ExamPageClientProps) {
  const [questionCount, setQuestionCount] = useState<(typeof QUESTION_COUNTS)[number]>(20);
  const [allCategories, setAllCategories] = useState(true);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [timeMode, setTimeMode] = useState<"preset" | "perQuestion">("preset");
  const [timePreset, setTimePreset] = useState<(typeof TIME_PRESETS)[number]>(30);
  const [error, setError] = useState<string | null>(null);
  const [activeExam, setActiveExam] = useState<ActiveExam | null>(null);
  const [isPending, startTransition] = useTransition();

  const computedPerQuestionMinutes = Math.ceil(questionCount * 1.5);

  function toggleCategory(id: string) {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function handleStart() {
    setError(null);

    if (!allCategories && selectedCategoryIds.length === 0) {
      setError("حداقل یک دسته را انتخاب کنید یا «همه دسته‌ها» را فعال کنید.");
      return;
    }

    const timeLimitMinutes = timeMode === "perQuestion" ? computedPerQuestionMinutes : timePreset;

    startTransition(async () => {
      const result = await startExamAction({
        questionCount,
        categoryIds: allCategories ? undefined : selectedCategoryIds,
        timeLimitMinutes,
        usePerQuestionTime: timeMode === "perQuestion",
      });

      if (!result.success) {
        setError(result.message);
        return;
      }

      setActiveExam({
        items: result.items,
        timeLimitMinutes: result.timeLimitMinutes,
        endsAt: Date.now() + result.timeLimitMinutes * 60_000,
      });
    });
  }

  if (activeExam) {
    return (
      <ExamPlayer
        items={activeExam.items}
        timeLimitMinutes={activeExam.timeLimitMinutes}
        endsAt={activeExam.endsAt}
        onExit={() => setActiveExam(null)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-bold">شبیه‌ساز آزمون</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          آزمون زمان‌دار با سؤالات تصادفی از کیس‌های منتشرشده — بدون نمایش پاسخ تا پایان آزمون.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="font-semibold">تنظیمات آزمون</div>
        </CardHeader>
        <CardContent className="space-y-6">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">تعداد سؤالات</legend>
            <div className="flex flex-wrap gap-2">
              {QUESTION_COUNTS.map((count) => (
                <label
                  key={count}
                  className={`cursor-pointer rounded-xl border px-4 py-2 text-sm ${
                    questionCount === count
                      ? "border-teal-600 bg-teal-50 text-teal-900"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <input
                    type="radio"
                    name="questionCount"
                    className="sr-only"
                    checked={questionCount === count}
                    onChange={() => setQuestionCount(count)}
                  />
                  {count.toLocaleString("fa-IR")} سؤال
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">دسته‌بندی</legend>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-teal-700"
                checked={allCategories}
                onChange={(event) => {
                  setAllCategories(event.target.checked);
                  if (event.target.checked) setSelectedCategoryIds([]);
                }}
              />
              همه دسته‌ها
            </label>

            {!allCategories ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {categories.map((category) => (
                  <label
                    key={category.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="accent-teal-700"
                      checked={selectedCategoryIds.includes(category.id)}
                      onChange={() => toggleCategory(category.id)}
                    />
                    {category.name}
                  </label>
                ))}
                {categories.length === 0 ? (
                  <p className="text-sm text-slate-500">دسته‌ای ثبت نشده است.</p>
                ) : null}
              </div>
            ) : null}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">مدت زمان</legend>
            <div className="flex flex-wrap gap-2">
              {TIME_PRESETS.map((minutes) => (
                <label
                  key={minutes}
                  className={`cursor-pointer rounded-xl border px-4 py-2 text-sm ${
                    timeMode === "preset" && timePreset === minutes
                      ? "border-teal-600 bg-teal-50 text-teal-900"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <input
                    type="radio"
                    name="timeLimit"
                    className="sr-only"
                    checked={timeMode === "preset" && timePreset === minutes}
                    onChange={() => {
                      setTimeMode("preset");
                      setTimePreset(minutes);
                    }}
                  />
                  {minutes.toLocaleString("fa-IR")} دقیقه
                </label>
              ))}
              <label
                className={`cursor-pointer rounded-xl border px-4 py-2 text-sm ${
                  timeMode === "perQuestion"
                    ? "border-teal-600 bg-teal-50 text-teal-900"
                    : "border-slate-200 bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="timeLimit"
                  className="sr-only"
                  checked={timeMode === "perQuestion"}
                  onChange={() => setTimeMode("perQuestion")}
                />
                ۱٫۵ دقیقه به ازای هر سؤال ({computedPerQuestionMinutes.toLocaleString("fa-IR")} دقیقه)
              </label>
            </div>
          </fieldset>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <Button type="button" className="w-full" disabled={isPending} onClick={handleStart}>
            {isPending ? "در حال آماده‌سازی..." : "شروع آزمون"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

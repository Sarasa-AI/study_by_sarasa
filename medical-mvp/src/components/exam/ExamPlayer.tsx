"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { QuestionFeedbackModal } from "@/components/case/QuestionFeedbackModal";
import { answerOptions } from "@/lib/case-schema";
import { submitExamAction, type ExamSubmitResultData } from "@/lib/exam-actions";
import type { ExamQuizItem } from "@/lib/exam-service";
import type { AnswerMap, QuizQuestionView } from "@/lib/quiz";

type ExamPlayerProps = {
  items: ExamQuizItem[];
  timeLimitMinutes: number;
  endsAt: number;
  onExit: () => void;
};

function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) {
    return `${seconds.toLocaleString("fa-IR")} ثانیه`;
  }
  if (seconds === 0) {
    return `${minutes.toLocaleString("fa-IR")} دقیقه`;
  }
  return `${minutes.toLocaleString("fa-IR")} دقیقه و ${seconds.toLocaleString("fa-IR")} ثانیه`;
}

function ExamReportView({
  result,
  items,
  onNewExam,
}: {
  result: ExamSubmitResultData;
  items: ExamQuizItem[];
  onNewExam: () => void;
}) {
  const questionMap = useMemo(
    () => Object.fromEntries(items.map((item) => [item.question.id, item])),
    [items],
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold">گزارش آزمون</h1>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onNewExam}>
            آزمون جدید
          </Button>
          {result.mistakeCount > 0 ? (
            <Link href="/practice/review">
              <Button type="button" variant="secondary">
                مرور اشتباهات
              </Button>
            </Link>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="text-lg font-bold">نتیجه کلی</div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="text-base font-medium">
            نمره: {result.score.toLocaleString("fa-IR")} از {result.total.toLocaleString("fa-IR")} (
            {result.percent.toLocaleString("fa-IR")}٪)
          </div>
          <div className="text-slate-600">زمان صرف‌شده: {formatDuration(result.timeSpent)}</div>
          {result.mistakeCount > 0 ? (
            <div className="text-rose-700">
              {result.mistakeCount.toLocaleString("fa-IR")} سؤال به صف مرور اشتباهات اضافه شد.
            </div>
          ) : (
            <div className="text-teal-800">همه پاسخ‌ها صحیح بودند — آفرین!</div>
          )}
        </CardContent>
      </Card>

      {result.feedback.map((item, index) => {
        const examItem = questionMap[item.questionId];
        const question = examItem?.question;
        const distractorEntries = item.distractorRationales
          ? (Object.entries(item.distractorRationales) as Array<
              [keyof NonNullable<typeof item.distractorRationales>, string]
            >)
          : [];

        return (
          <Card key={item.questionId} className={item.isCorrect ? "border-green-200" : "border-red-200"}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">سوال {index + 1}</div>
                <span className={`text-sm ${item.isCorrect ? "text-green-700" : "text-red-600"}`}>
                  {item.isCorrect ? "صحیح" : "نادرست"}
                </span>
              </div>
              {examItem ? (
                <div className="mt-1 text-xs text-slate-500">
                  {examItem.case.title} · {examItem.category.name}
                </div>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {question ? <div>{question.questionText}</div> : null}
              <div className="text-slate-600">
                پاسخ شما: {item.selected ?? "—"} | پاسخ صحیح: {item.correctAnswer}
              </div>
              {item.explanation ? (
                <div className="rounded-xl bg-muted p-3 text-slate-700">{item.explanation}</div>
              ) : null}
              {item.clinicalReasoning ? (
                <div className="rounded-xl border border-teal-200 bg-teal-50/80 p-3">
                  <div className="mb-1.5 text-sm font-semibold text-teal-900">استدلال بالینی</div>
                  <div className="whitespace-pre-wrap leading-7 text-slate-800">{item.clinicalReasoning}</div>
                </div>
              ) : null}
              {distractorEntries.length > 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 text-sm font-semibold text-slate-900">دلایل رد گزینه‌ها</div>
                  <ul className="space-y-2">
                    {distractorEntries.map(([optionKey, rationale]) => {
                      const isSelectedWrong = !item.isCorrect && item.selected === optionKey;
                      const optionText = question?.options[optionKey];
                      return (
                        <li
                          key={optionKey}
                          className={`rounded-lg border px-3 py-2 ${
                            isSelectedWrong
                              ? "border-red-200 bg-red-50 text-red-950"
                              : "border-slate-200 bg-white text-slate-800"
                          }`}
                        >
                          <div className="font-medium">
                            {optionKey}. {optionText ?? ""}
                            {isSelectedWrong ? (
                              <span className="mr-2 text-xs font-normal text-red-700"> (انتخاب شما)</span>
                            ) : null}
                          </div>
                          <div className="mt-1 leading-6 text-slate-700">{rationale}</div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function ExamPlayer({ items, timeLimitMinutes, endsAt, onExit }: ExamPlayerProps) {
  const questionIds = useMemo(() => items.map((item) => item.question.id), [items]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [flagged, setFlagged] = useState<Set<string>>(() => new Set());
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)),
  );
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<ExamSubmitResultData | null>(null);

  const startedAtRef = useRef(Date.now());
  const submittedRef = useRef(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const currentItem = items[currentIndex];
  const currentQuestion: QuizQuestionView | undefined = currentItem?.question;
  const urgent = remainingSeconds <= 5 * 60;

  const finalizeSubmit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setIsSubmitting(true);
    setServerError(null);
    setShowConfirm(false);

    const timeSpent = Math.round((Date.now() - startedAtRef.current) / 1000);

    try {
      const actionResult = await submitExamAction(questionIds, answersRef.current, timeSpent);
      if (!actionResult.success) {
        submittedRef.current = false;
        setServerError(actionResult.message);
        return;
      }
      setResult(actionResult.data);
    } catch {
      submittedRef.current = false;
      setServerError("خطا در ارسال آزمون");
    } finally {
      setIsSubmitting(false);
    }
  }, [questionIds]);

  useEffect(() => {
    const tick = () => {
      const next = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setRemainingSeconds(next);
      if (next <= 0) {
        void finalizeSubmit();
      }
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [endsAt, finalizeSubmit]);

  function selectAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  function toggleFlag(questionId: string) {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  }

  if (result) {
    return (
      <div className="min-h-screen bg-slate-50">
        <ExamReportView result={result} items={items} onNewExam={onExit} />
      </div>
    );
  }

  if (!currentQuestion || !currentItem) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white print:hidden">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-base font-bold">شبیه‌ساز آزمون</div>
              <div className="text-xs text-slate-500">
                {items.length.toLocaleString("fa-IR")} سؤال · سقف زمانی{" "}
                {timeLimitMinutes.toLocaleString("fa-IR")} دقیقه
              </div>
            </div>
            <div
              className={`rounded-xl px-4 py-2 font-mono text-xl font-bold tabular-nums ${
                urgent ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-900"
              }`}
              aria-live="polite"
            >
              {formatCountdown(remainingSeconds)}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {items.map((item, index) => {
              const qid = item.question.id;
              const isAnswered = Boolean(answers[qid]);
              const isFlagged = flagged.has(qid);
              const isCurrent = index === currentIndex;

              return (
                <button
                  key={qid}
                  type="button"
                  onClick={() => setCurrentIndex(index)}
                  className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium ${
                    isCurrent
                      ? "bg-teal-700 text-white"
                      : isFlagged
                        ? "border border-amber-400 bg-amber-50 text-amber-900"
                        : isAnswered
                          ? "bg-teal-100 text-teal-900"
                          : "bg-slate-100 text-slate-600"
                  }`}
                  aria-label={`سؤال ${index + 1}`}
                >
                  {(index + 1).toLocaleString("fa-IR")}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 overflow-y-auto px-4 py-6">
        <div className="text-sm text-slate-500">
          سؤال {(currentIndex + 1).toLocaleString("fa-IR")} از {items.length.toLocaleString("fa-IR")}
          <span className="mx-2">·</span>
          {currentItem.case.title}
          <span className="mx-2">·</span>
          {currentItem.category.name}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="font-semibold leading-7">{currentQuestion.questionText}</div>
              <QuestionFeedbackModal questionId={currentQuestion.id} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {answerOptions.map((key) => (
                <label
                  key={key}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm ${
                    answers[currentQuestion.id] === key
                      ? "border-teal-600 bg-teal-50"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name={currentQuestion.id}
                    value={key}
                    className="accent-teal-700"
                    checked={answers[currentQuestion.id] === key}
                    onChange={() => selectAnswer(currentQuestion.id, key)}
                  />
                  <span>
                    {key}. {currentQuestion.options[key]}
                  </span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
          >
            قبلی
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={currentIndex >= items.length - 1}
            onClick={() => setCurrentIndex((index) => Math.min(items.length - 1, index + 1))}
          >
            بعدی
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => toggleFlag(currentQuestion.id)}
          >
            {flagged.has(currentQuestion.id) ? "حذف نشانه" : "نشانه‌گذاری برای مرور"}
          </Button>
          <Button
            type="button"
            className="mr-auto"
            disabled={isSubmitting}
            onClick={() => setShowConfirm(true)}
          >
            ثبت نهایی آزمون
          </Button>
        </div>

        {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
      </main>

      {showConfirm ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="font-semibold">تأیید ثبت نهایی</div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-700">آیا از ثبت نهایی آزمون اطمینان دارید؟</p>
              <p className="text-xs text-slate-500">
                پاسخ‌داده‌شده:{" "}
                {Object.keys(answers).length.toLocaleString("fa-IR")} از{" "}
                {items.length.toLocaleString("fa-IR")}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  disabled={isSubmitting}
                  onClick={() => setShowConfirm(false)}
                >
                  انصراف
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  disabled={isSubmitting}
                  onClick={() => void finalizeSubmit()}
                >
                  {isSubmitting ? "در حال ثبت..." : "ثبت نهایی"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronLeft, ChevronRight, Flag } from "lucide-react";
import { ClinicalImageViewer } from "@/components/case/ClinicalImageViewer";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { answerOptions } from "@/lib/case-schema";
import {
  finishExam,
  submitAnswer,
  type ExamQuestionPublic,
} from "@/lib/exam-session-actions";
import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";
import { useEscapeKey } from "@/lib/hooks/useEscapeKey";
import { cn } from "@/lib/utils";

type ExamRunnerProps = {
  sessionId: string;
  examTitle: string;
  durationMinutes: number;
  startedAtIso: string;
  questions: ExamQuestionPublic[];
  initialAnswers: Record<string, string>;
};

function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function ExamRunner({
  sessionId,
  examTitle,
  durationMinutes,
  startedAtIso,
  questions,
  initialAnswers,
}: ExamRunnerProps) {
  const router = useRouter();
  const endsAt = new Date(startedAtIso).getTime() + durationMinutes * 60_000;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)),
  );
  const [tabWarning, setTabWarning] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const closeConfirm = useCallback(() => {
    if (!isSubmitting) setShowConfirm(false);
  }, [isSubmitting]);

  useBodyScrollLock(showConfirm);
  useEscapeKey(closeConfirm, showConfirm);

  const finishedRef = useRef(false);
  const currentQuestion = questions[currentIndex];
  const urgent = remainingSeconds <= 5 * 60;

  const finalizeExam = useCallback(async () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setIsSubmitting(true);
    setServerError(null);
    setShowConfirm(false);

    try {
      const result = await finishExam(sessionId);
      if (!result.success) {
        finishedRef.current = false;
        setServerError(result.message);
        return;
      }
      router.push(`/exams/${sessionId}/results`);
    } catch {
      finishedRef.current = false;
      setServerError("خطا در ثبت نهایی آزمون");
    } finally {
      setIsSubmitting(false);
    }
  }, [router, sessionId]);

  useEffect(() => {
    const tick = () => {
      const next = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setRemainingSeconds(next);
      if (next <= 0) {
        void finalizeExam();
      }
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [endsAt, finalizeExam]);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.hidden) {
        setTabWarning(true);
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  async function selectOption(questionId: string, option: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
    setServerError(null);

    const result = await submitAnswer(sessionId, questionId, option);
    if (!result.success) {
      setServerError(result.message);
    }
  }

  if (!currentQuestion) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-base font-bold text-slate-900">{examTitle}</div>
              <div className="text-xs text-slate-500">
                {questions.length.toLocaleString("fa-IR")} سؤال · سقف زمانی{" "}
                {durationMinutes.toLocaleString("fa-IR")} دقیقه
              </div>
            </div>
            <div
              className={cn(
                "rounded-xl px-4 py-2 font-mono text-xl font-bold tabular-nums",
                urgent ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-900",
              )}
              aria-live="polite"
            >
              {formatCountdown(remainingSeconds)}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {questions.map((question, index) => {
              const isAnswered = Boolean(answers[question.id]);
              const isCurrent = index === currentIndex;

              return (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => setCurrentIndex(index)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium",
                    isCurrent
                      ? "bg-teal-700 text-white"
                      : isAnswered
                        ? "bg-teal-100 text-teal-900"
                        : "bg-slate-100 text-slate-600",
                  )}
                  aria-label={`سؤال ${index + 1}`}
                >
                  {(index + 1).toLocaleString("fa-IR")}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {tabWarning ? (
        <div
          className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          role="alert"
        >
          <div className="mx-auto flex max-w-5xl items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">هشدار تغییر تب</p>
              <p className="mt-0.5 text-rose-700">
                ترک صفحه در حین آزمون ثبت شد. لطفاً تا پایان آزمون در همین صفحه بمانید.
              </p>
            </div>
            <button
              type="button"
              className="text-xs font-medium text-rose-700 underline"
              onClick={() => setTabWarning(false)}
            >
              بستن
            </button>
          </div>
        </div>
      ) : null}

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 overflow-y-auto px-4 py-6">
        <div className="text-sm text-slate-500">
          سؤال {(currentIndex + 1).toLocaleString("fa-IR")} از{" "}
          {questions.length.toLocaleString("fa-IR")}
        </div>

        {currentQuestion.chiefComplaint ||
        currentQuestion.patientInfo ||
        currentQuestion.mediaUrl ? (
          <Card className="border-teal-100 bg-teal-50/40">
            <CardHeader>
              <div className="text-sm font-semibold text-teal-900">سناریوی بالینی</div>
            </CardHeader>
            <CardContent className="space-y-3">
              {currentQuestion.chiefComplaint ? (
                <div>
                  <div className="text-xs text-slate-500">شکایت اصلی</div>
                  <p className="text-sm leading-7 text-slate-800">{currentQuestion.chiefComplaint}</p>
                </div>
              ) : null}
              {currentQuestion.patientInfo ? (
                <div>
                  <div className="text-xs text-slate-500">اطلاعات بیمار</div>
                  <p className="whitespace-pre-wrap text-sm leading-7 text-slate-800">
                    {currentQuestion.patientInfo}
                  </p>
                </div>
              ) : null}
              {currentQuestion.mediaUrl ? (
                <ClinicalImageViewer src={currentQuestion.mediaUrl} />
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <div className="font-semibold leading-7 text-slate-900">
              {currentQuestion.questionText}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {answerOptions.map((key) => (
                <label
                  key={key}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm",
                    answers[currentQuestion.id] === key
                      ? "border-teal-600 bg-teal-50"
                      : "border-slate-200 hover:bg-slate-50",
                  )}
                >
                  <input
                    type="radio"
                    name={currentQuestion.id}
                    value={key}
                    className="accent-teal-700"
                    checked={answers[currentQuestion.id] === key}
                    onChange={() => void selectOption(currentQuestion.id, key)}
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
            className="gap-1"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
          >
            <ChevronRight className="h-4 w-4" />
            قبلی
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="gap-1"
            disabled={currentIndex >= questions.length - 1}
            onClick={() => setCurrentIndex((index) => Math.min(questions.length - 1, index + 1))}
          >
            بعدی
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            className="mr-auto gap-2"
            disabled={isSubmitting}
            onClick={() => setShowConfirm(true)}
          >
            <Flag className="h-4 w-4" />
            ثبت نهایی آزمون
          </Button>
        </div>

        {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
      </main>

      {showConfirm ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="exam-confirm-title"
          onClick={closeConfirm}
        >
          <Card className="w-full max-w-md" onClick={(event) => event.stopPropagation()}>
            <CardHeader>
              <div id="exam-confirm-title" className="font-semibold">
                تأیید ثبت نهایی
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-700">آیا از ثبت نهایی آزمون اطمینان دارید؟</p>
              <p className="text-xs text-slate-500">
                پاسخ‌داده‌شده: {Object.keys(answers).length.toLocaleString("fa-IR")} از{" "}
                {questions.length.toLocaleString("fa-IR")}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  disabled={isSubmitting}
                  onClick={closeConfirm}
                >
                  انصراف
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  disabled={isSubmitting}
                  onClick={() => void finalizeExam()}
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

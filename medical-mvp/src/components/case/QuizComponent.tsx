"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { answerOptions } from "@/lib/case-schema";
import {
  buildQuizAnswersSchema,
  type QuizFormValues,
  type QuizQuestionView,
  type QuizResultData,
} from "@/lib/quiz";
import { submitQuizAction } from "@/lib/quiz-actions";
import type { MentorQuizContext } from "@/lib/mentor-types";

const STEP_THRESHOLD = 5;

type QuizComponentProps = {
  caseId: string;
  caseTitle: string;
  questions: QuizQuestionView[];
  onQuizContextChange?: (ctx: MentorQuizContext) => void;
};

function AnimatedXpCounter({ total }: { total: number }) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    if (total === 0) return;

    const duration = 800;
    const start = performance.now();

    let frameId = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      setDisplayed(Math.round(total * progress));
      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [total]);

  if (total === 0) return null;

  return (
    <div className="rounded-xl bg-teal-50 px-4 py-3 text-teal-900">
      <div className="text-xs font-medium text-teal-700">XP کسب‌شده</div>
      <div
        className="text-2xl font-bold tabular-nums transition-opacity duration-300"
        style={{ opacity: displayed > 0 ? 1 : 0.5 }}
      >
        +{displayed} XP
      </div>
    </div>
  );
}

function StreakMilestoneBanner({ visible }: { visible: boolean }) {
  const [show, setShow] = useState(visible);

  useEffect(() => {
    if (!visible) return;
    setShow(true);
    const timer = setTimeout(() => setShow(false), 5000);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!show) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 opacity-100 transition-opacity duration-500">
      <div className="font-semibold">دستاورد جدید!</div>
      <div className="text-sm">۳ روز متوالی فعالیت — بونوس استریک فعال شد!</div>
    </div>
  );
}

function QuizResultView({
  caseTitle,
  result,
  questions,
}: {
  caseTitle: string;
  result: QuizResultData;
  questions: QuizQuestionView[];
}) {
  const questionMap = useMemo(
    () => Object.fromEntries(questions.map((question) => [question.id, question])),
    [questions],
  );

  return (
    <div className="space-y-4">
      <StreakMilestoneBanner visible={result.isNewStreakMilestone} />

      <Card>
        <CardHeader>
          <div className="text-lg font-bold">نتیجه آزمون</div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm">کیس: {caseTitle}</div>
          <div className="text-sm font-medium">
            نمره: {result.score} از {result.total} ({result.percent}%)
          </div>
          <AnimatedXpCounter total={result.xp.total} />
          <Link href={`/quiz/result?id=${result.resultId}`} className="text-sm text-teal-700 underline">
            مشاهده نتیجه ذخیره‌شده
          </Link>
        </CardContent>
      </Card>

      {result.feedback.map((item, index) => {
        const question = questionMap[item.questionId];
        return (
          <Card key={item.questionId} className={item.isCorrect ? "border-green-200" : "border-red-200"}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">سوال {index + 1}</div>
                <span className={`text-sm ${item.isCorrect ? "text-green-700" : "text-red-600"}`}>
                  {item.isCorrect ? "صحیح" : "نادرست"}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {question ? <div>{question.questionText}</div> : null}
              {!item.isCorrect ? (
                <>
                  <div className="text-slate-600">
                    پاسخ شما: {item.selected ?? "—"} | پاسخ صحیح: {item.correctAnswer}
                  </div>
                  {item.explanation ? (
                    <div className="rounded-xl bg-muted p-3 text-slate-700">{item.explanation}</div>
                  ) : null}
                </>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function QuestionCard({
  question,
  index,
  register,
  error,
}: {
  question: QuizQuestionView;
  index: number;
  register: ReturnType<typeof useForm<QuizFormValues>>["register"];
  error?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="font-semibold">سوال {index + 1}</div>
      </CardHeader>
      <CardContent>
        <div className="mb-3">{question.questionText}</div>
        <div className="grid gap-2">
          {answerOptions.map((key) => (
            <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="radio" value={key} {...register(question.id)} className="accent-teal-700" />
              <span>
                {key}. {question.options[key]}
              </span>
            </label>
          ))}
        </div>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </CardContent>
    </Card>
  );
}

export function QuizComponent({
  caseId,
  caseTitle,
  questions,
  onQuizContextChange,
}: QuizComponentProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<QuizResultData | null>(null);
  const startedAtRef = useRef(Date.now());

  const useStepper = questions.length > STEP_THRESHOLD;
  const schema = useMemo(
    () => buildQuizAnswersSchema(questions.map((question) => question.id)),
    [questions],
  );
  const defaultValues = useMemo(
    () => Object.fromEntries(questions.map((question) => [question.id, undefined])),
    [questions],
  );

  const {
    register,
    handleSubmit,
    trigger,
    watch,
    formState: { errors },
  } = useForm<QuizFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const watchedAnswers = watch();

  useEffect(() => {
    onQuizContextChange?.({
      answers: watchedAnswers,
      result,
    });
  }, [watchedAnswers, result, onQuizContextChange]);

  async function onSubmit(values: QuizFormValues) {
    setIsSubmitting(true);
    setServerError(null);

    const timeSpent = Math.round((Date.now() - startedAtRef.current) / 1000);

    try {
      const actionResult = await submitQuizAction(caseId, values, timeSpent);
      if (!actionResult.success) {
        setServerError(actionResult.message);
        return;
      }
      setResult(actionResult.data!);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (result) {
    return <QuizResultView caseTitle={caseTitle} result={result} questions={questions} />;
  }

  async function goToNextStep() {
    const currentQuestion = questions[currentStep];
    const valid = await trigger(currentQuestion.id);
    if (valid) {
      setCurrentStep((step) => Math.min(step + 1, questions.length - 1));
    }
  }

  function goToPreviousStep() {
    setCurrentStep((step) => Math.max(step - 1, 0));
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      {useStepper ? (
        <>
          <div className="text-sm text-slate-600">
            سوال {currentStep + 1} از {questions.length}
          </div>
          <QuestionCard
            question={questions[currentStep]}
            index={currentStep}
            register={register}
            error={errors[questions[currentStep].id]?.message}
          />
          <div className="flex gap-2">
            <Button type="button" variant="secondary" disabled={currentStep === 0} onClick={goToPreviousStep}>
              قبلی
            </Button>
            {currentStep < questions.length - 1 ? (
              <Button type="button" className="flex-1" onClick={goToNextStep}>
                بعدی
              </Button>
            ) : (
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? "در حال ارسال..." : "ارسال آزمون"}
              </Button>
            )}
          </div>
        </>
      ) : (
        <>
          {questions.map((question, index) => (
            <QuestionCard
              key={question.id}
              question={question}
              index={index}
              register={register}
              error={errors[question.id]?.message}
            />
          ))}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "در حال ارسال..." : "ارسال آزمون"}
          </Button>
        </>
      )}

      {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
    </form>
  );
}

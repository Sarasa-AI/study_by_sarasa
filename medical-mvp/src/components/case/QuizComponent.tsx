"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { QuestionFeedbackModal } from "@/components/case/QuestionFeedbackModal";
import { answerOptions } from "@/lib/case-schema";
import {
  buildQuizAnswersSchema,
  type QuizActionResult,
  type QuizFormValues,
  type QuizQuestionView,
  type QuizResultData,
} from "@/lib/quiz";
import { submitQuizAction } from "@/lib/quiz-actions";
import type { MentorQuizContext } from "@/lib/mentor-types";

const STEP_THRESHOLD = 5;

type QuizComponentProps = {
  caseId?: string;
  caseTitle?: string;
  questions: QuizQuestionView[];
  onQuizContextChange?: (ctx: MentorQuizContext) => void;
  submitFn?: (answers: QuizFormValues, timeSpent: number) => Promise<QuizActionResult>;
  resultHeading?: string;
};

function GamificationSummaryCard({ gamification }: { gamification: QuizResultData["gamification"] }) {
  if (gamification.xpEarned === 0) return null;

  const hasRemedialBonus = gamification.xpEarned >= 25;

  return (
    <div className="min-w-0 break-words animate-pulse rounded-xl border border-amber-200 bg-gradient-to-l from-amber-50 to-teal-50 px-4 py-4 text-slate-900 [animation-iteration-count:1]">
      <div className="text-sm font-semibold text-teal-800">خلاصه امتیازات</div>
      <div className="mt-2 space-y-1">
        <div className="text-xl font-bold tabular-nums sm:text-2xl">🎯 +{gamification.xpEarned} XP</div>
        <div className="text-sm font-medium sm:text-base">🔥 استریک: {gamification.newStreak} روز</div>
        {hasRemedialBonus ? (
          <div className="text-sm text-amber-800">تمرین هدفمند — بونوس نقاط ضعف</div>
        ) : null}
      </div>
    </div>
  );
}

function QuizResultView({
  resultHeading,
  result,
  questions,
}: {
  resultHeading: string;
  result: QuizResultData;
  questions: QuizQuestionView[];
}) {
  const questionMap = useMemo(
    () => Object.fromEntries(questions.map((question) => [question.id, question])),
    [questions],
  );

  return (
    <div className="space-y-4">
      <GamificationSummaryCard gamification={result.gamification} />

      {result.newAchievements && result.newAchievements.length > 0 ? (
        <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
          مدال جدید:{" "}
          {result.newAchievements.map((a) => `${a.icon} ${a.title}`).join("، ")}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <div className="text-lg font-bold">نتیجه آزمون</div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm">{resultHeading}</div>
          <div className="text-sm font-medium">
            نمره: {result.score} از {result.total} ({result.percent}%)
          </div>
          {result.resultId ? (
            <Link href={`/quiz/result?id=${result.resultId}`} className="text-sm text-teal-700 underline">
              مشاهده نتیجه ذخیره‌شده
            </Link>
          ) : null}
        </CardContent>
      </Card>

      {result.feedback.map((item, index) => {
        const question = questionMap[item.questionId];
        const distractorEntries = item.distractorRationales
          ? (Object.entries(item.distractorRationales) as Array<[keyof NonNullable<typeof item.distractorRationales>, string]>)
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
        <div className="flex items-center justify-between gap-2">
          <div className="font-semibold">سوال {index + 1}</div>
          <QuestionFeedbackModal questionId={question.id} />
        </div>
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
  submitFn,
  resultHeading,
}: QuizComponentProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<QuizResultData | null>(null);
  const startedAtRef = useRef(Date.now());

  const heading = resultHeading ?? (caseTitle ? `کیس: ${caseTitle}` : "نتیجه آزمون");
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
      const actionResult = submitFn
        ? await submitFn(values, timeSpent)
        : caseId
          ? await submitQuizAction(caseId, values, timeSpent)
          : { success: false as const, message: "شناسه کیس مشخص نشده است" };

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
    return <QuizResultView resultHeading={heading} result={result} questions={questions} />;
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

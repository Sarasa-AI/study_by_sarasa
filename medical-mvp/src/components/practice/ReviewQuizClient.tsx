"use client";

import { useMemo } from "react";
import { QuizComponent } from "@/components/case/QuizComponent";
import type { ReviewQuizItem } from "@/lib/practice-service";
import type { QuizFormValues } from "@/lib/quiz";
import { submitReviewQuizAction } from "@/lib/quiz-actions";

type ReviewQuizClientProps = {
  items: ReviewQuizItem[];
};

export function ReviewQuizClient({ items }: ReviewQuizClientProps) {
  const questions = useMemo(() => items.map((item) => item.question), [items]);
  const questionIds = useMemo(() => items.map((item) => item.question.id), [items]);

  async function submitFn(answers: QuizFormValues, timeSpent: number) {
    return submitReviewQuizAction(questionIds, answers, timeSpent);
  }

  return (
    <QuizComponent
      questions={questions}
      submitFn={submitFn}
      resultHeading="مرور سؤالات اشتباه"
    />
  );
}

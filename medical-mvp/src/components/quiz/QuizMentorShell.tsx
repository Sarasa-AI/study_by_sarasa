"use client";

import { useState } from "react";
import { QuizComponent } from "@/components/case/QuizComponent";
import { ClinicalMentorChat } from "@/components/quiz/ClinicalMentorChat";
import type { ClinicalMentorCaseContext, MentorQuizContext } from "@/lib/mentor-types";
import type { QuizQuestionView } from "@/lib/quiz";

type QuizMentorShellProps = {
  caseId: string;
  caseTitle: string;
  caseContext: ClinicalMentorCaseContext;
  questions: QuizQuestionView[];
};

const initialQuizContext: MentorQuizContext = {
  answers: {},
  result: null,
};

export function QuizMentorShell({
  caseId,
  caseTitle,
  caseContext,
  questions,
}: QuizMentorShellProps) {
  const [quizContext, setQuizContext] = useState<MentorQuizContext>(initialQuizContext);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <QuizComponent
        caseId={caseId}
        caseTitle={caseTitle}
        questions={questions}
        onQuizContextChange={setQuizContext}
      />
      <ClinicalMentorChat caseContext={caseContext} quizContext={quizContext} />
    </div>
  );
}

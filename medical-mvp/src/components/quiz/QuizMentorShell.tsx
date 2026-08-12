"use client";

import { useState } from "react";
import { ClinicalImageViewer } from "@/components/case/ClinicalImageViewer";
import { QuizComponent } from "@/components/case/QuizComponent";
import { ClinicalMentorChat } from "@/components/quiz/ClinicalMentorChat";
import type { ClinicalMentorCaseContext, MentorQuizContext } from "@/lib/mentor-types";
import type { QuizQuestionView } from "@/lib/quiz";

type QuizMentorShellProps = {
  caseId: string;
  caseTitle: string;
  caseContext: ClinicalMentorCaseContext;
  questions: QuizQuestionView[];
  mediaUrl?: string | null;
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
  mediaUrl = null,
}: QuizMentorShellProps) {
  const [quizContext, setQuizContext] = useState<MentorQuizContext>(initialQuizContext);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        {mediaUrl ? <ClinicalImageViewer src={mediaUrl} /> : null}
        <QuizComponent
          caseId={caseId}
          caseTitle={caseTitle}
          questions={questions}
          onQuizContextChange={setQuizContext}
        />
      </div>
      <ClinicalMentorChat caseContext={caseContext} quizContext={quizContext} />
    </div>
  );
}

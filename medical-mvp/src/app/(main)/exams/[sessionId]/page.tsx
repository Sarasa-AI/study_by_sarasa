import { redirect } from "next/navigation";
import { ExamSessionStatus } from "@prisma/client";
import { ExamRunner } from "@/components/exam/ExamRunner";
import { getSessionUser } from "@/lib/auth";
import type { ExamQuestionPublic } from "@/lib/exam-session-actions";
import { prisma } from "@/lib/prisma";

type ExamSessionPageProps = {
  params: { sessionId: string };
};

export default async function ExamSessionPage({ params }: ExamSessionPageProps) {
  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    redirect("/login");
  }

  const session = await prisma.examSession.findFirst({
    where: {
      id: params.sessionId,
      userId: sessionUser.id,
    },
    include: {
      exam: {
        select: {
          title: true,
          durationMinutes: true,
          questions: {
            orderBy: { orderIndex: "asc" },
            include: {
              question: {
                select: {
                  id: true,
                  questionText: true,
                  optionA: true,
                  optionB: true,
                  optionC: true,
                  optionD: true,
                  case: {
                    select: {
                      mediaUrl: true,
                      mediaType: true,
                      chiefComplaint: true,
                      patientInfo: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      answers: {
        select: {
          questionId: true,
          selectedOption: true,
        },
      },
    },
  });

  if (!session) {
    redirect("/exams");
  }

  if (session.status === ExamSessionStatus.COMPLETED) {
    redirect(`/exams/${session.id}/results`);
  }

  if (session.status !== ExamSessionStatus.IN_PROGRESS) {
    redirect("/exams");
  }

  const questions: ExamQuestionPublic[] = session.exam.questions.map((eq) => {
    const mediaUrl =
      eq.question.case.mediaType === "IMAGE" || !eq.question.case.mediaType
        ? eq.question.case.mediaUrl
        : null;

    return {
      id: eq.question.id,
      questionText: eq.question.questionText,
      options: {
        A: eq.question.optionA,
        B: eq.question.optionB,
        C: eq.question.optionC,
        D: eq.question.optionD,
      },
      orderIndex: eq.orderIndex,
      mediaUrl,
      chiefComplaint: eq.question.case.chiefComplaint,
      patientInfo: eq.question.case.patientInfo,
    };
  });

  const initialAnswers = Object.fromEntries(
    session.answers.map((answer) => [answer.questionId, answer.selectedOption]),
  );

  return (
    <ExamRunner
      sessionId={session.id}
      examTitle={session.exam.title}
      durationMinutes={session.exam.durationMinutes}
      startedAtIso={session.startedAt.toISOString()}
      questions={questions}
      initialAnswers={initialAnswers}
    />
  );
}

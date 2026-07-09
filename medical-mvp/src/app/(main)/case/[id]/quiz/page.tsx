import { QuizMentorShell } from "@/components/quiz/QuizMentorShell";
import { buildMentorCaseContext } from "@/lib/mentor-service";
import { prisma } from "@/lib/prisma";
import { serializeQuizQuestions } from "@/lib/quiz";

export default async function QuizPage({ params }: { params: { id: string } }) {
  const kase = await prisma.case.findUnique({
    where: { id: params.id },
    include: {
      questions: {
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  if (!kase) {
    return <div>کیس یافت نشد</div>;
  }

  if (kase.questions.length === 0) {
    return <div>سوالی برای این کیس ثبت نشده است</div>;
  }

  const questions = serializeQuizQuestions(kase.questions);
  const caseContext = buildMentorCaseContext(kase);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{kase.title}</h1>
      <QuizMentorShell
        caseId={kase.id}
        caseTitle={kase.title}
        caseContext={caseContext}
        questions={questions}
      />
    </div>
  );
}

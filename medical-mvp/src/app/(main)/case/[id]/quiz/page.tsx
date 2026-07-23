import { CaseBookmarkButton } from "@/components/case/CaseBookmarkButton";
import { PersonalNoteEditor } from "@/components/case/PersonalNoteEditor";
import { QuizMentorShell } from "@/components/quiz/QuizMentorShell";
import { getSessionUser } from "@/lib/auth";
import { getCaseBookmarkAndNote } from "@/lib/bookmark-service";
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

  const sessionUser = await getSessionUser();
  const bookmarkState = sessionUser?.id
    ? await getCaseBookmarkAndNote(sessionUser.id, kase.id)
    : { bookmarked: false, noteContent: null };

  const questions = serializeQuizQuestions(kase.questions);
  const caseContext = buildMentorCaseContext(kase);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold">{kase.title}</h1>
        <CaseBookmarkButton
          caseId={kase.id}
          initialBookmarked={bookmarkState.bookmarked}
        />
      </div>
      <PersonalNoteEditor
        caseId={kase.id}
        initialContent={bookmarkState.noteContent}
      />
      <QuizMentorShell
        caseId={kase.id}
        caseTitle={kase.title}
        caseContext={caseContext}
        questions={questions}
      />
    </div>
  );
}

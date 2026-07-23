import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serializeQuizQuestions, type QuizQuestionView } from "@/lib/quiz";

export type ExamQuizItem = {
  question: QuizQuestionView;
  case: { id: string; title: string };
  category: { id: string; name: string };
};

export type ExamCategoryOption = {
  id: string;
  name: string;
};

export type GenerateExamQuizOptions = {
  questionCount: number;
  categoryIds?: string[];
  timeLimitMinutes: number;
};

export type GenerateExamQuizResult = {
  items: ExamQuizItem[];
  timeLimitMinutes: number;
  generatedAt: string;
};

export async function listExamCategories(): Promise<ExamCategoryOption[]> {
  return prisma.category.findMany({
    orderBy: { orderIndex: "asc" },
    select: { id: true, name: true },
  });
}

export async function generateExamQuiz(
  _userId: string,
  options: GenerateExamQuizOptions,
): Promise<GenerateExamQuizResult> {
  const questionCount = Math.max(1, Math.floor(options.questionCount));
  const categoryIds = options.categoryIds?.filter(Boolean) ?? [];

  const idRows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT q.id
    FROM "Question" q
    INNER JOIN "Case" c ON c.id = q."caseId"
    WHERE c.status = 'PUBLISHED'
      ${
        categoryIds.length > 0
          ? Prisma.sql`AND c."categoryId" IN (${Prisma.join(categoryIds)})`
          : Prisma.empty
      }
    ORDER BY RANDOM()
    LIMIT ${questionCount}
  `;

  if (idRows.length === 0) {
    return {
      items: [],
      timeLimitMinutes: options.timeLimitMinutes,
      generatedAt: new Date().toISOString(),
    };
  }

  const ids = idRows.map((row) => row.id);
  const questions = await prisma.question.findMany({
    where: { id: { in: ids } },
    include: {
      case: {
        select: {
          id: true,
          title: true,
          category: { select: { id: true, name: true } },
        },
      },
    },
  });

  const byId = new Map(questions.map((question) => [question.id, question]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as typeof questions;

  const items: ExamQuizItem[] = ordered.map((question) => {
    const [serialized] = serializeQuizQuestions([question]);
    return {
      question: serialized,
      case: {
        id: question.case.id,
        title: question.case.title,
      },
      category: {
        id: question.case.category.id,
        name: question.case.category.name,
      },
    };
  });

  return {
    items,
    timeLimitMinutes: options.timeLimitMinutes,
    generatedAt: new Date().toISOString(),
  };
}

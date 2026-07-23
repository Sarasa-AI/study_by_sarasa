import { prisma } from "@/lib/prisma";
import { serializeQuizQuestions, type QuizQuestionView } from "@/lib/quiz";

export type ReviewQuizItem = {
  mistakeId: string;
  question: QuizQuestionView;
  case: { id: string; title: string; categoryId: string };
};

export async function getPendingMistakesCount(userId: string): Promise<number> {
  return prisma.questionMistake.count({
    where: { userId, isResolved: false },
  });
}

export async function generateReviewQuiz(
  userId: string,
  limit: number = 10,
): Promise<ReviewQuizItem[]> {
  const mistakes = await prisma.questionMistake.findMany({
    where: { userId, isResolved: false },
    orderBy: { updatedAt: "asc" },
    take: limit,
    include: {
      question: {
        include: {
          case: {
            select: {
              id: true,
              title: true,
              categoryId: true,
            },
          },
        },
      },
    },
  });

  return mistakes.map((mistake) => {
    const [question] = serializeQuizQuestions([mistake.question]);
    return {
      mistakeId: mistake.id,
      question,
      case: {
        id: mistake.question.case.id,
        title: mistake.question.case.title,
        categoryId: mistake.question.case.categoryId,
      },
    };
  });
}

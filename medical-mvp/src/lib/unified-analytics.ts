import { ExamSessionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const WEAK_ACCURACY_THRESHOLD = 60;
const MAX_WEAK_CATEGORIES = 3;

export type UnifiedCategoryPerformance = {
  categoryId: string;
  name: string;
  correct: number;
  incorrect: number;
  accuracy: number;
};

export type UnifiedWeakCategory = UnifiedCategoryPerformance;

type CategoryBucket = {
  categoryId: string;
  name: string;
  correct: number;
  incorrect: number;
};

function toAccuracy(correct: number, incorrect: number): number {
  const total = correct + incorrect;
  return total === 0 ? 0 : Math.round((correct / total) * 10000) / 100;
}

function bumpBucket(
  buckets: Map<string, CategoryBucket>,
  categoryId: string,
  name: string,
  correctDelta: number,
  incorrectDelta: number,
): void {
  const existing = buckets.get(categoryId) ?? {
    categoryId,
    name,
    correct: 0,
    incorrect: 0,
  };
  existing.correct += correctDelta;
  existing.incorrect += incorrectDelta;
  buckets.set(categoryId, existing);
}

/**
 * Aggregates per-category accuracy from both ExamAnswer (timed exams)
 * and QuizResult (practice/remedial quizzes) into a single performance map.
 */
export async function getUnifiedCategoryPerformance(
  userId: string,
): Promise<UnifiedCategoryPerformance[]> {
  const [examAnswers, quizResults] = await Promise.all([
    prisma.examAnswer.findMany({
      where: {
        session: {
          userId,
          status: ExamSessionStatus.COMPLETED,
        },
      },
      select: {
        isCorrect: true,
        question: {
          select: {
            case: {
              select: {
                category: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.quizResult.findMany({
      where: { userId },
      select: {
        score: true,
        totalQuestions: true,
        case: {
          select: {
            category: {
              select: { id: true, name: true },
            },
          },
        },
      },
    }),
  ]);

  const buckets = new Map<string, CategoryBucket>();

  for (const answer of examAnswers) {
    const category = answer.question.case.category;
    bumpBucket(
      buckets,
      category.id,
      category.name,
      answer.isCorrect ? 1 : 0,
      answer.isCorrect ? 0 : 1,
    );
  }

  for (const result of quizResults) {
    const category = result.case.category;
    const incorrect = Math.max(0, result.totalQuestions - result.score);
    bumpBucket(buckets, category.id, category.name, result.score, incorrect);
  }

  return [...buckets.values()]
    .map((item) => ({
      ...item,
      accuracy: toAccuracy(item.correct, item.incorrect),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fa"));
}

/**
 * Returns the user's weakest categories from unified Exam + Quiz performance.
 * Prefer accuracy below 60%; otherwise return the lowest-performing categories.
 * Capped at the top 3 weakest.
 */
export async function getUnifiedWeakCategories(
  userId: string,
): Promise<UnifiedWeakCategory[]> {
  const performance = await getUnifiedCategoryPerformance(userId);
  if (performance.length === 0) {
    return [];
  }

  const underThreshold = performance
    .filter((item) => item.accuracy < WEAK_ACCURACY_THRESHOLD)
    .sort((a, b) => a.accuracy - b.accuracy || b.incorrect - a.incorrect);

  if (underThreshold.length > 0) {
    return underThreshold.slice(0, MAX_WEAK_CATEGORIES);
  }

  return [...performance]
    .sort((a, b) => a.accuracy - b.accuracy || b.incorrect - a.incorrect)
    .slice(0, MAX_WEAK_CATEGORIES);
}

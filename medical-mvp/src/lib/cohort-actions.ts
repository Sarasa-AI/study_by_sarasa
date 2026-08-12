"use server";

import { ExamSessionStatus, Role } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { requireInstructorApi } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withServerAction } from "@/lib/server-action";

const WEAK_ACCURACY_THRESHOLD = 60;

export type CategoryPerformanceItem = {
  categoryId: string;
  name: string;
  correct: number;
  incorrect: number;
  accuracy: number;
};

export type StudentRosterItem = {
  studentId: string;
  name: string;
  completedExams: number;
  averageAccuracy: number;
};

export type ClassAnalyticsData = {
  totalStudents: number;
  classAverageAccuracy: number;
  categoryPerformance: CategoryPerformanceItem[];
  studentRoster: StudentRosterItem[];
};

export type ClassAnalyticsResult =
  | { success: true; data: ClassAnalyticsData }
  | { success: false; message: string };

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

function roundScore(value: number | null | undefined): number {
  return Math.round((value ?? 0) * 100) / 100;
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

const EMPTY_ANALYTICS: ClassAnalyticsData = {
  totalStudents: 0,
  classAverageAccuracy: 0,
  categoryPerformance: [],
  studentRoster: [],
};

async function loadClassAnalytics(): Promise<ClassAnalyticsData> {
  const students = await prisma.user.findMany({
    where: { role: Role.STUDENT },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  if (students.length === 0) {
    return EMPTY_ANALYTICS;
  }

  const studentIds = students.map((s) => s.id);
  const completedWhere = {
    userId: { in: studentIds },
    status: ExamSessionStatus.COMPLETED,
  };

  const [scoreAgg, perStudentAgg, examAnswers, quizResults] = await Promise.all([
    prisma.examSession.aggregate({
      where: {
        ...completedWhere,
        score: { not: null },
      },
      _avg: { score: true },
    }),
    prisma.examSession.groupBy({
      by: ["userId"],
      where: {
        ...completedWhere,
        score: { not: null },
      },
      _avg: { score: true },
      _count: { id: true },
    }),
    prisma.examAnswer.findMany({
      where: {
        session: completedWhere,
      },
      select: {
        isCorrect: true,
        question: {
          select: {
            case: {
              select: {
                category: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    }),
    prisma.quizResult.findMany({
      where: { userId: { in: studentIds } },
      select: {
        score: true,
        totalQuestions: true,
        case: {
          select: {
            category: { select: { id: true, name: true } },
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

  const categoryPerformance: CategoryPerformanceItem[] = [...buckets.values()]
    .map((item) => ({
      ...item,
      accuracy: toAccuracy(item.correct, item.incorrect),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fa"));

  const statsByUser = new Map(
    perStudentAgg.map((row) => [
      row.userId,
      {
        completedExams: row._count.id,
        averageAccuracy: roundScore(row._avg.score),
      },
    ]),
  );

  const studentRoster: StudentRosterItem[] = students
    .map((student) => {
      const stats = statsByUser.get(student.id);
      return {
        studentId: student.id,
        name: student.name,
        completedExams: stats?.completedExams ?? 0,
        averageAccuracy: stats?.averageAccuracy ?? 0,
      };
    })
    .sort(
      (a, b) =>
        b.averageAccuracy - a.averageAccuracy ||
        a.name.localeCompare(b.name, "fa"),
    );

  return {
    totalStudents: students.length,
    classAverageAccuracy: roundScore(scoreAgg._avg.score),
    categoryPerformance,
    studentRoster,
  };
}

const getCachedClassAnalytics = unstable_cache(
  loadClassAnalytics,
  ["cohort-analytics"],
  {
    revalidate: 60,
    tags: ["cohort-analytics"],
  },
);

export async function getClassAnalytics(): Promise<ClassAnalyticsResult> {
  const instructor = await requireInstructorApi();
  if (!instructor) {
    return {
      success: false,
      message: "فقط استادان می‌توانند تحلیل کلاس را مشاهده کنند",
    };
  }

  return withServerAction(
    { operation: "cohort.getClassAnalytics", userId: instructor.id },
    async () => ({ success: true as const, data: await getCachedClassAnalytics() }),
  );
}

export { WEAK_ACCURACY_THRESHOLD };

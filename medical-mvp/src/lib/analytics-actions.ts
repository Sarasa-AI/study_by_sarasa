"use server";

import { ExamSessionStatus } from "@prisma/client";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withServerAction } from "@/lib/server-action";
import { getUnifiedCategoryPerformance } from "@/lib/unified-analytics";

const SCORE_TREND_LIMIT = 20;

export type UserStatsData = {
  totalExams: number;
  averageScore: number;
  totalQuestionsAnswered: number;
};

export type ScoreTrendPoint = {
  sessionId: string;
  examTitle: string;
  completedAt: string;
  score: number;
};

export type CategoryPerformanceItem = {
  categoryId: string;
  name: string;
  correct: number;
  incorrect: number;
  accuracy: number;
};

export type UserStatsResult =
  | { success: true; data: UserStatsData }
  | { success: false; message: string };

export type ScoreTrendResult =
  | { success: true; data: ScoreTrendPoint[] }
  | { success: false; message: string };

export type CategoryPerformanceResult =
  | { success: true; data: CategoryPerformanceItem[] }
  | { success: false; message: string };

export async function getUserStats(): Promise<UserStatsResult> {
  const user = await getSessionUser();
  if (!user?.id) {
    return { success: false, message: "برای مشاهده آمار باید وارد شوید" };
  }

  return withServerAction(
    { operation: "analytics.userStats", userId: user.id },
    async () => {
      const completedWhere = {
        userId: user.id,
        status: ExamSessionStatus.COMPLETED,
      };

      const [totalExams, scoreAgg, totalQuestionsAnswered] = await Promise.all([
        prisma.examSession.count({ where: completedWhere }),
        prisma.examSession.aggregate({
          where: {
            ...completedWhere,
            score: { not: null },
          },
          _avg: { score: true },
        }),
        prisma.examAnswer.count({
          where: {
            session: completedWhere,
          },
        }),
      ]);

      return {
        success: true as const,
        data: {
          totalExams,
          averageScore: Math.round((scoreAgg._avg.score ?? 0) * 100) / 100,
          totalQuestionsAnswered,
        },
      };
    },
  );
}

export async function getScoreTrend(): Promise<ScoreTrendResult> {
  const user = await getSessionUser();
  if (!user?.id) {
    return { success: false, message: "برای مشاهده روند نمرات باید وارد شوید" };
  }

  return withServerAction(
    { operation: "analytics.scoreTrend", userId: user.id },
    async () => {
      const sessions = await prisma.examSession.findMany({
        where: {
          userId: user.id,
          status: ExamSessionStatus.COMPLETED,
          completedAt: { not: null },
          score: { not: null },
        },
        orderBy: { completedAt: "desc" },
        take: SCORE_TREND_LIMIT,
        select: {
          id: true,
          score: true,
          completedAt: true,
          exam: { select: { title: true } },
        },
      });

      const chronological = [...sessions].reverse();

      return {
        success: true as const,
        data: chronological.map((session) => ({
          sessionId: session.id,
          examTitle: session.exam.title,
          completedAt: session.completedAt!.toISOString(),
          score: session.score!,
        })),
      };
    },
  );
}

export async function getCategoryPerformance(): Promise<CategoryPerformanceResult> {
  const user = await getSessionUser();
  if (!user?.id) {
    return { success: false, message: "برای مشاهده عملکرد دسته‌بندی باید وارد شوید" };
  }

  return withServerAction(
    { operation: "analytics.categoryPerformance", userId: user.id },
    async () => {
      const data = await getUnifiedCategoryPerformance(user.id);
      return { success: true as const, data };
    },
  );
}

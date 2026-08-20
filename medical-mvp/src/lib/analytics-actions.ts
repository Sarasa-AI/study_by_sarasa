"use server";

import { ExamSessionStatus } from "@prisma/client";
import { getSessionUser } from "@/lib/auth";
import { getLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { type ActionResult, withServerAction } from "@/lib/server-action";
import { serializeError } from "@/lib/serialize-error";
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

export type UserStatsResult = ActionResult<UserStatsData>;
export type ScoreTrendResult = ActionResult<ScoreTrendPoint[]>;
export type CategoryPerformanceResult = ActionResult<CategoryPerformanceItem[]>;

export async function getUserStats(): Promise<UserStatsResult> {
  const user = await getSessionUser();
  if (!user?.id) {
    return { success: false, message: "برای مشاهده آمار باید وارد شوید", data: null };
  }

  return withServerAction(
    { operation: "analytics.userStats", userId: user.id },
    async () => {
      try {
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
          message: "آمار کاربر بارگذاری شد",
          data: {
            totalExams,
            averageScore: Math.round((scoreAgg._avg.score ?? 0) * 100) / 100,
            totalQuestionsAnswered,
          },
        };
      } catch (error) {
        getLogger().error(
          { event: "analytics.user_stats.failed", userId: user.id, err: serializeError(error) },
          "User analytics stats failed",
        );
        return { success: false as const, message: "خطا در بارگذاری آمار", data: null };
      }
    },
  );
}

export async function getScoreTrend(): Promise<ScoreTrendResult> {
  const user = await getSessionUser();
  if (!user?.id) {
    return { success: false, message: "برای مشاهده روند نمرات باید وارد شوید", data: null };
  }

  return withServerAction(
    { operation: "analytics.scoreTrend", userId: user.id },
    async () => {
      try {
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

        const data = [...sessions].reverse().flatMap((session) =>
          session.completedAt && session.score != null
            ? [{
                sessionId: session.id,
                examTitle: session.exam.title,
                completedAt: session.completedAt.toISOString(),
                score: session.score,
              }]
            : [],
        );

        return { success: true as const, message: "روند نمرات بارگذاری شد", data };
      } catch (error) {
        getLogger().error(
          { event: "analytics.score_trend.failed", userId: user.id, err: serializeError(error) },
          "Score trend failed",
        );
        return { success: false as const, message: "خطا در بارگذاری روند نمرات", data: null };
      }
    },
  );
}

export async function getCategoryPerformance(): Promise<CategoryPerformanceResult> {
  const user = await getSessionUser();
  if (!user?.id) {
    return { success: false, message: "برای مشاهده عملکرد دسته‌بندی باید وارد شوید", data: null };
  }

  return withServerAction(
    { operation: "analytics.categoryPerformance", userId: user.id },
    async () => {
      try {
        const data = await getUnifiedCategoryPerformance(user.id);
        return { success: true as const, message: "عملکرد دسته‌بندی بارگذاری شد", data };
      } catch (error) {
        getLogger().error(
          { event: "analytics.category_performance.failed", userId: user.id, err: serializeError(error) },
          "Category performance failed",
        );
        return {
          success: false as const,
          message: "خطا در بارگذاری عملکرد دسته‌بندی",
          data: null,
        };
      }
    },
  );
}

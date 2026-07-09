"use server";

import { getServerSession } from "next-auth";
import {
  getStudentPerformanceStats,
  type StudentPerformanceStats,
} from "@/lib/analytics-service";
import { prisma } from "@/lib/prisma";

export type DashboardStreak = {
  currentStreak: number;
  longestStreak: number;
  lastQuizCompletedAt: Date | null;
};

export type DashboardStatsData = StudentPerformanceStats & {
  streak: DashboardStreak;
  totalXp: number;
  totalCasesCompleted: number;
};

export type DashboardStatsResult = {
  success: boolean;
  message?: string;
  data?: DashboardStatsData;
};

async function resolveUserId(): Promise<string | null> {
  const session = await getServerSession();
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

export async function getDashboardStatsAction(): Promise<DashboardStatsResult> {
  const userId = await resolveUserId();
  if (!userId) {
    return { success: false, message: "برای مشاهده داشبورد باید وارد شوید" };
  }

  try {
    const [stats, user, totalCasesCompleted] = await Promise.all([
      getStudentPerformanceStats(userId),
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          totalXp: true,
          currentStreak: true,
          longestStreak: true,
          lastQuizCompletedAt: true,
        },
      }),
      prisma.quizResult.count({ where: { userId } }),
    ]);

    return {
      success: true,
      data: {
        ...stats,
        streak: {
          currentStreak: user.currentStreak,
          longestStreak: user.longestStreak,
          lastQuizCompletedAt: user.lastQuizCompletedAt,
        },
        totalXp: user.totalXp,
        totalCasesCompleted,
      },
    };
  } catch {
    return { success: false, message: "خطا در بارگذاری آمار داشبورد" };
  }
}

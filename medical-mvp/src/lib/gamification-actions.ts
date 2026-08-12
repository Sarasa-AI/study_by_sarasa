"use server";

import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withServerAction } from "@/lib/server-action";
import { getUnifiedWeakCategories } from "@/lib/unified-analytics";

const BASE_ANSWER_XP = 10;
const WEAK_TOPIC_MULTIPLIER = 1.5;
const LEAGUE_TOP_N = 25;
const DEFAULT_LEAGUE_TIER = 5;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const TIER_NAMES_FA: Record<number, string> = {
  1: "لیگ طلا",
  2: "لیگ نقره",
  3: "لیگ برنز",
  4: "لیگ مس",
  5: "لیگ چوب",
};

export type GamificationStats = {
  totalXP: number;
  currentStreak: number;
  freezeTokens: number;
  accuracyPercent: number;
  leagueTier: number | null;
};

export type LeagueMemberRow = {
  rank: number;
  userId: string;
  name: string;
  weeklyXP: number;
  accuracyPercent: number;
  isCurrentUser: boolean;
};

export type WeeklyLeagueResult = {
  tier: number;
  tierName: string;
  weekStartDate: Date;
  weekEndsAt: Date;
  members: LeagueMemberRow[];
  currentUserRank: number | null;
  freezeTokens: number;
  weeklyXP: number;
};

export type RecordExamAnswerXpResult = {
  awarded: boolean;
  xpEarned: number;
};

export type UpdateStreakResult = {
  currentStreak: number;
  longestStreak: number;
  freezeTokens: number;
  freezeUsed: boolean;
  changed: boolean;
};

function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function utcDayDiff(later: Date, earlier: Date): number {
  const laterMs = Date.parse(`${utcDayKey(later)}T00:00:00.000Z`);
  const earlierMs = Date.parse(`${utcDayKey(earlier)}T00:00:00.000Z`);
  return Math.round((laterMs - earlierMs) / MS_PER_DAY);
}

function getCurrentWeekStart(now = new Date()): Date {
  const day = now.getUTCDay(); // 0 = Sunday
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceMonday),
  );
}

function getWeekEndsAt(weekStart: Date): Date {
  return new Date(weekStart.getTime() + 7 * MS_PER_DAY);
}

function getLeagueTierName(tier: number): string {
  return TIER_NAMES_FA[tier] ?? `لیگ سطح ${tier}`;
}

async function computeAccuracyPercent(userId: string): Promise<number> {
  const [total, correct] = await Promise.all([
    prisma.examAnswer.count({
      where: { session: { userId } },
    }),
    prisma.examAnswer.count({
      where: { session: { userId }, isCorrect: true },
    }),
  ]);

  if (total === 0) return 0;
  return Math.round((correct / total) * 10000) / 100;
}

async function ensureLeagueForWeek(weekStart: Date, tier: number) {
  return prisma.league.upsert({
    where: {
      weekStartDate_tier: {
        weekStartDate: weekStart,
        tier,
      },
    },
    create: {
      weekStartDate: weekStart,
      tier,
    },
    update: {},
  });
}

/**
 * Ensures a UserGamification row exists and is joined to the current week's league.
 * Resets freeze tokens to 2 when rolling into a new week.
 */
async function ensureUserGamification(userId: string) {
  const weekStart = getCurrentWeekStart();

  let gamification = await prisma.userGamification.findUnique({
    where: { userId },
    include: { league: true },
  });

  if (!gamification) {
    const league = await ensureLeagueForWeek(weekStart, DEFAULT_LEAGUE_TIER);
    gamification = await prisma.userGamification.create({
      data: {
        userId,
        freezeTokens: 2,
        leagueId: league.id,
      },
      include: { league: true },
    });
    await prisma.leagueMembership.upsert({
      where: {
        userId_leagueId: { userId, leagueId: league.id },
      },
      create: { userId, leagueId: league.id, weeklyXP: 0 },
      update: {},
    });
    return gamification;
  }

  const leagueIsCurrent =
    gamification.league != null &&
    gamification.league.weekStartDate.getTime() === weekStart.getTime();

  if (!leagueIsCurrent) {
    const tier = gamification.league?.tier ?? DEFAULT_LEAGUE_TIER;
    const league = await ensureLeagueForWeek(weekStart, tier);
    gamification = await prisma.userGamification.update({
      where: { userId },
      data: {
        leagueId: league.id,
        freezeTokens: 2,
      },
      include: { league: true },
    });
    await prisma.leagueMembership.upsert({
      where: {
        userId_leagueId: { userId, leagueId: league.id },
      },
      create: { userId, leagueId: league.id, weeklyXP: 0 },
      update: {},
    });
    return gamification;
  }

  if (gamification.leagueId) {
    await prisma.leagueMembership.upsert({
      where: {
        userId_leagueId: { userId, leagueId: gamification.leagueId },
      },
      create: { userId, leagueId: gamification.leagueId, weeklyXP: 0 },
      update: {},
    });
  }

  return gamification;
}

export async function getGamificationStats(): Promise<
  | { success: true; data: GamificationStats }
  | { success: false; message: string }
> {
  const user = await getSessionUser();
  if (!user?.id) {
    return { success: false, message: "برای مشاهده آمار باید وارد شوید" };
  }

  return withServerAction(
    { operation: "gamification.getStats", userId: user.id },
    async () => {
      const gamification = await ensureUserGamification(user.id);
      const accuracyPercent = await computeAccuracyPercent(user.id);

      return {
        success: true as const,
        data: {
          totalXP: gamification.totalXP,
          currentStreak: gamification.currentStreak,
          freezeTokens: gamification.freezeTokens,
          accuracyPercent,
          leagueTier: gamification.league?.tier ?? null,
        },
      };
    },
  );
}

export async function recordExamAnswerXP(
  examAnswerId: string,
): Promise<
  | { success: true; data: RecordExamAnswerXpResult }
  | { success: false; message: string }
> {
  const user = await getSessionUser();
  if (!user?.id) {
    return { success: false, message: "برای دریافت امتیاز باید وارد شوید" };
  }

  return withServerAction(
    { operation: "gamification.recordExamAnswerXP", userId: user.id, input: { examAnswerId } },
    async () => {
      const answer = await prisma.examAnswer.findUnique({
        where: { id: examAnswerId },
        select: {
          id: true,
          isCorrect: true,
          xpAwarded: true,
          session: { select: { userId: true } },
          question: {
            select: {
              case: { select: { categoryId: true } },
            },
          },
        },
      });

      if (!answer || answer.session.userId !== user.id) {
        return { success: false as const, message: "پاسخ یافت نشد" };
      }

      if (!answer.isCorrect || answer.xpAwarded) {
        return {
          success: true as const,
          data: { awarded: false, xpEarned: 0 },
        };
      }

      const weakCategories = await getUnifiedWeakCategories(user.id);
      const weakCategoryIds = new Set(weakCategories.map((c) => c.categoryId));
      const categoryId = answer.question.case.categoryId;
      const isWeak = weakCategoryIds.has(categoryId);
      const xpEarned = isWeak
        ? Math.round(BASE_ANSWER_XP * WEAK_TOPIC_MULTIPLIER)
        : BASE_ANSWER_XP;

      const gamification = await ensureUserGamification(user.id);
      if (!gamification.leagueId) {
        return { success: false as const, message: "لیگ کاربر یافت نشد" };
      }

      await prisma.$transaction(async (tx) => {
        const claimed = await tx.examAnswer.updateMany({
          where: { id: examAnswerId, xpAwarded: false, isCorrect: true },
          data: { xpAwarded: true },
        });

        if (claimed.count === 0) {
          return;
        }

        await tx.userGamification.update({
          where: { userId: user.id },
          data: { totalXP: { increment: xpEarned } },
        });

        await tx.leagueMembership.update({
          where: {
            userId_leagueId: {
              userId: user.id,
              leagueId: gamification.leagueId!,
            },
          },
          data: { weeklyXP: { increment: xpEarned } },
        });
      });

      const awarded = (
        await prisma.examAnswer.findUnique({
          where: { id: examAnswerId },
          select: { xpAwarded: true },
        })
      )?.xpAwarded;

      return {
        success: true as const,
        data: {
          awarded: Boolean(awarded),
          xpEarned: awarded ? xpEarned : 0,
        },
      };
    },
  );
}

export async function updateStreak(): Promise<
  | { success: true; data: UpdateStreakResult }
  | { success: false; message: string }
> {
  const user = await getSessionUser();
  if (!user?.id) {
    return { success: false, message: "برای به‌روزرسانی استریک باید وارد شوید" };
  }

  return withServerAction(
    { operation: "gamification.updateStreak", userId: user.id },
    async () => {
      const now = new Date();
      const gamification = await ensureUserGamification(user.id);

      if (gamification.lastActiveDate && utcDayDiff(now, gamification.lastActiveDate) === 0) {
        return {
          success: true as const,
          data: {
            currentStreak: gamification.currentStreak,
            longestStreak: gamification.longestStreak,
            freezeTokens: gamification.freezeTokens,
            freezeUsed: false,
            changed: false,
          },
        };
      }

      let newStreak = 1;
      let freezeTokens = gamification.freezeTokens;
      let freezeUsed = false;

      if (gamification.lastActiveDate) {
        const dayDiff = utcDayDiff(now, gamification.lastActiveDate);

        if (dayDiff === 1) {
          newStreak = Math.max(1, gamification.currentStreak) + 1;
        } else if (dayDiff === 2 && freezeTokens > 0) {
          // Missed exactly yesterday — consume one freeze token and preserve streak
          newStreak = Math.max(1, gamification.currentStreak);
          freezeTokens -= 1;
          freezeUsed = true;
        } else {
          newStreak = 1;
        }
      }

      const longestStreak = Math.max(gamification.longestStreak, newStreak);

      const updated = await prisma.userGamification.update({
        where: { userId: user.id },
        data: {
          currentStreak: newStreak,
          longestStreak,
          freezeTokens,
          lastActiveDate: now,
        },
      });

      return {
        success: true as const,
        data: {
          currentStreak: updated.currentStreak,
          longestStreak: updated.longestStreak,
          freezeTokens: updated.freezeTokens,
          freezeUsed,
          changed: true,
        },
      };
    },
  );
}

export async function getWeeklyLeague(): Promise<
  | { success: true; data: WeeklyLeagueResult }
  | { success: false; message: string }
> {
  const user = await getSessionUser();
  if (!user?.id) {
    return { success: false, message: "برای مشاهده لیگ باید وارد شوید" };
  }

  return withServerAction(
    { operation: "gamification.getWeeklyLeague", userId: user.id },
    async () => {
      const gamification = await ensureUserGamification(user.id);
      if (!gamification.leagueId || !gamification.league) {
        return { success: false as const, message: "لیگ فعلی یافت نشد" };
      }

      const weekStart = gamification.league.weekStartDate;
      const weekEndsAt = getWeekEndsAt(weekStart);
      const tier = gamification.league.tier;

      const memberships = await prisma.leagueMembership.findMany({
        where: { leagueId: gamification.leagueId },
        orderBy: [{ weeklyXP: "desc" }, { user: { name: "asc" } }],
        take: LEAGUE_TOP_N,
        include: {
          user: { select: { id: true, name: true } },
        },
      });

      const userIds = memberships.map((m) => m.userId);
      const accuracyByUser = new Map<string, number>();

      if (userIds.length > 0) {
        const answers = await prisma.examAnswer.findMany({
          where: { session: { userId: { in: userIds } } },
          select: {
            isCorrect: true,
            session: { select: { userId: true } },
          },
        });

        const buckets = new Map<string, { correct: number; total: number }>();
        for (const answer of answers) {
          const uid = answer.session.userId;
          const bucket = buckets.get(uid) ?? { correct: 0, total: 0 };
          bucket.total += 1;
          if (answer.isCorrect) bucket.correct += 1;
          buckets.set(uid, bucket);
        }

        for (const [uid, bucket] of buckets) {
          accuracyByUser.set(
            uid,
            bucket.total === 0 ? 0 : Math.round((bucket.correct / bucket.total) * 10000) / 100,
          );
        }
      }

      const members: LeagueMemberRow[] = memberships.map((m, index) => ({
        rank: index + 1,
        userId: m.userId,
        name: m.user.name,
        weeklyXP: m.weeklyXP,
        accuracyPercent: accuracyByUser.get(m.userId) ?? 0,
        isCurrentUser: m.userId === user.id,
      }));

      const currentMembership = await prisma.leagueMembership.findUnique({
        where: {
          userId_leagueId: {
            userId: user.id,
            leagueId: gamification.leagueId,
          },
        },
      });

      let currentUserRank: number | null =
        members.find((m) => m.isCurrentUser)?.rank ?? null;

      if (currentUserRank == null && currentMembership) {
        const higherCount = await prisma.leagueMembership.count({
          where: {
            leagueId: gamification.leagueId,
            weeklyXP: { gt: currentMembership.weeklyXP },
          },
        });
        currentUserRank = higherCount + 1;
      }

      return {
        success: true as const,
        data: {
          tier,
          tierName: getLeagueTierName(tier),
          weekStartDate: weekStart,
          weekEndsAt,
          members,
          currentUserRank,
          freezeTokens: gamification.freezeTokens,
          weeklyXP: currentMembership?.weeklyXP ?? 0,
        },
      };
    },
  );
}

import type { Achievement, AchievementCategory, Prisma } from "@prisma/client";
import { ProgressStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type GamificationAward = {
  xpEarned: number;
  currentStreak: number;
  streakMaintained: boolean;
};

export type StreakUpdate = {
  newStreak: number;
  streakMaintained: boolean;
};

export type PrismaTx = Prisma.TransactionClient;

export type AchievementUnlock = {
  code: string;
  title: string;
  description: string;
  icon: string;
};

export type UserAchievementStats = {
  currentStreak: number;
  completedCases: number;
  flashcardsReviewed: number;
  questionsAnswered: number;
  accuracyPercent: number;
};

export type AchievementDef = Pick<
  Achievement,
  "id" | "code" | "title" | "description" | "icon" | "category" | "threshold"
>;

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  name: string;
  totalXp: number;
  weeklyXp: number;
  currentStreak: number;
  isCurrentUser: boolean;
};

export type LeaderboardBoard = {
  entries: LeaderboardEntry[];
  currentUser: LeaderboardEntry | null;
};

export type LeaderboardData = {
  overall: LeaderboardBoard;
  weekly: LeaderboardBoard;
};

export type UserAchievementView = {
  id: string;
  code: string;
  title: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  threshold: number;
  isUnlocked: boolean;
  unlockedAt: Date | null;
  progress: number;
  currentValue: number;
};

type AwardUpdateRow = {
  currentStreak: number;
  streakMaintained: boolean;
};

const BASE_COMPLETION_XP = 10;
const HIGH_ACCURACY_BONUS = 5;
const REMEDIAL_BONUS = 15;
const HIGH_ACCURACY_THRESHOLD = 0.8;
const ACCURACY_BADGE_MIN_QUESTIONS = 20;
const LEADERBOARD_LIMIT = 20;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function utcDayDiff(later: Date, earlier: Date): number {
  const laterMs = Date.parse(`${utcDayKey(later)}T00:00:00.000Z`);
  const earlierMs = Date.parse(`${utcDayKey(earlier)}T00:00:00.000Z`);
  return Math.round((laterMs - earlierMs) / (24 * 60 * 60 * 1000));
}

export function calculateXp(accuracy: number, isRemedial: boolean): number {
  let xp = BASE_COMPLETION_XP;

  if (accuracy >= HIGH_ACCURACY_THRESHOLD) {
    xp += HIGH_ACCURACY_BONUS;
  }

  if (isRemedial) {
    xp += REMEDIAL_BONUS;
  }

  return xp;
}

export function calculateStreakUpdate(
  lastCompletedAt: Date | null,
  now: Date,
  currentStreak: number,
): StreakUpdate {
  if (!lastCompletedAt) {
    return { newStreak: 1, streakMaintained: false };
  }

  const dayDiff = utcDayDiff(now, lastCompletedAt);

  if (dayDiff === 0) {
    return { newStreak: currentStreak, streakMaintained: true };
  }

  if (dayDiff === 1) {
    return { newStreak: currentStreak + 1, streakMaintained: true };
  }

  return { newStreak: 1, streakMaintained: false };
}

export function getAchievementCurrentValue(
  achievement: Pick<AchievementDef, "code" | "category">,
  stats: UserAchievementStats,
): number {
  if (achievement.code === "QUESTIONS_50") {
    return stats.questionsAnswered;
  }

  if (achievement.code === "ACCURACY_80") {
    return stats.accuracyPercent;
  }

  switch (achievement.category) {
    case "STREAK":
      return stats.currentStreak;
    case "CASES":
      return stats.completedCases;
    case "FLASHCARDS":
      return stats.flashcardsReviewed;
    case "ACCURACY":
      return stats.accuracyPercent;
    default:
      return 0;
  }
}

export function isAchievementEarned(
  achievement: Pick<AchievementDef, "code" | "category" | "threshold">,
  stats: UserAchievementStats,
): boolean {
  if (achievement.code === "ACCURACY_80") {
    return (
      stats.questionsAnswered >= ACCURACY_BADGE_MIN_QUESTIONS &&
      stats.accuracyPercent >= achievement.threshold
    );
  }

  return getAchievementCurrentValue(achievement, stats) >= achievement.threshold;
}

export function evaluateAchievementUnlocks(
  stats: UserAchievementStats,
  achievements: AchievementDef[],
  alreadyUnlockedIds: Set<string>,
): AchievementDef[] {
  return achievements.filter(
    (achievement) =>
      !alreadyUnlockedIds.has(achievement.id) && isAchievementEarned(achievement, stats),
  );
}

export async function awardQuizCompletion(
  userId: string,
  accuracy: number,
  isRemedial: boolean,
  prismaTx: PrismaTx,
): Promise<GamificationAward> {
  const xpEarned = calculateXp(accuracy, isRemedial);

  const rows = await prismaTx.$queryRaw<AwardUpdateRow[]>`
    WITH prior AS (
      SELECT "currentStreak", "lastQuizCompletedAt"
      FROM "User"
      WHERE "id" = ${userId}
      FOR UPDATE
    ),
    updated AS (
      UPDATE "User" AS u
      SET
        "totalXp" = u."totalXp" + ${xpEarned},
        "currentStreak" = CASE
          WHEN p."lastQuizCompletedAt" IS NULL THEN 1
          WHEN date_trunc('day', p."lastQuizCompletedAt" AT TIME ZONE 'UTC')
            = date_trunc('day', NOW() AT TIME ZONE 'UTC') THEN p."currentStreak"
          WHEN date_trunc('day', p."lastQuizCompletedAt" AT TIME ZONE 'UTC')
            = date_trunc('day', (NOW() AT TIME ZONE 'UTC' - interval '1 day')) THEN p."currentStreak" + 1
          ELSE 1
        END,
        "longestStreak" = GREATEST(
          u."longestStreak",
          CASE
            WHEN p."lastQuizCompletedAt" IS NULL THEN 1
            WHEN date_trunc('day', p."lastQuizCompletedAt" AT TIME ZONE 'UTC')
              = date_trunc('day', NOW() AT TIME ZONE 'UTC') THEN p."currentStreak"
            WHEN date_trunc('day', p."lastQuizCompletedAt" AT TIME ZONE 'UTC')
              = date_trunc('day', (NOW() AT TIME ZONE 'UTC' - interval '1 day')) THEN p."currentStreak" + 1
            ELSE 1
          END
        ),
        "lastQuizCompletedAt" = NOW()
      FROM prior AS p
      WHERE u."id" = ${userId}
      RETURNING
        u."currentStreak",
        p."lastQuizCompletedAt" AS "priorLastQuizCompletedAt"
    )
    SELECT
      "currentStreak",
      CASE
        WHEN "priorLastQuizCompletedAt" IS NULL THEN false
        WHEN date_trunc('day', "priorLastQuizCompletedAt" AT TIME ZONE 'UTC')
          = date_trunc('day', NOW() AT TIME ZONE 'UTC') THEN true
        WHEN date_trunc('day', "priorLastQuizCompletedAt" AT TIME ZONE 'UTC')
          = date_trunc('day', (NOW() AT TIME ZONE 'UTC' - interval '1 day')) THEN true
        ELSE false
      END AS "streakMaintained"
    FROM updated
  `;

  const row = rows[0];
  if (!row) {
    throw new Error(`User not found for gamification award: ${userId}`);
  }

  return {
    xpEarned,
    currentStreak: row.currentStreak,
    streakMaintained: row.streakMaintained,
  };
}

export async function claimQuizXpAward(
  userId: string,
  caseId: string,
  quizResultId: string,
  xpEarned: number,
  prismaTx: PrismaTx,
): Promise<boolean> {
  const claimed = await prismaTx.$queryRaw<Array<{ id: string }>>`
    UPDATE "QuizResult"
    SET "xpAwarded" = true,
        "xpEarned" = ${xpEarned}
    WHERE "id" = ${quizResultId}
      AND NOT EXISTS (
        SELECT 1
        FROM "QuizResult" AS qr
        WHERE qr."userId" = ${userId}
          AND qr."caseId" = ${caseId}
          AND qr."xpAwarded" = true
          AND qr."id" <> ${quizResultId}
      )
    RETURNING "id"
  `;

  return claimed.length > 0;
}

async function loadUserAchievementStats(userId: string): Promise<UserAchievementStats> {
  const [user, completedCases, flashcardsReviewed, quizAgg] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { currentStreak: true },
    }),
    prisma.userProgress.count({
      where: { userId, status: ProgressStatus.COMPLETED },
    }),
    prisma.userFlashcardProgress.count({
      where: { userId, lastReviewedAt: { not: null } },
    }),
    prisma.quizResult.aggregate({
      where: { userId },
      _sum: { score: true, totalQuestions: true },
    }),
  ]);

  const questionsAnswered = quizAgg._sum.totalQuestions ?? 0;
  const scoreSum = quizAgg._sum.score ?? 0;
  const accuracyPercent =
    questionsAnswered > 0 ? Math.round((scoreSum / questionsAnswered) * 100) : 0;

  return {
    currentStreak: user.currentStreak,
    completedCases,
    flashcardsReviewed,
    questionsAnswered,
    accuracyPercent,
  };
}

export async function checkAndAwardAchievements(userId: string): Promise<AchievementUnlock[]> {
  const [stats, achievements, existing] = await Promise.all([
    loadUserAchievementStats(userId),
    prisma.achievement.findMany({
      select: {
        id: true,
        code: true,
        title: true,
        description: true,
        icon: true,
        category: true,
        threshold: true,
      },
    }),
    prisma.userAchievement.findMany({
      where: { userId },
      select: { achievementId: true },
    }),
  ]);

  const alreadyUnlocked = new Set(existing.map((row) => row.achievementId));
  const newlyEarned = evaluateAchievementUnlocks(stats, achievements, alreadyUnlocked);

  if (newlyEarned.length === 0) {
    return [];
  }

  await prisma.userAchievement.createMany({
    data: newlyEarned.map((achievement) => ({
      userId,
      achievementId: achievement.id,
    })),
    skipDuplicates: true,
  });

  return newlyEarned.map((achievement) => ({
    code: achievement.code,
    title: achievement.title,
    description: achievement.description,
    icon: achievement.icon,
  }));
}

export async function getUserAchievements(userId: string): Promise<UserAchievementView[]> {
  const [stats, achievements, unlocks] = await Promise.all([
    loadUserAchievementStats(userId),
    prisma.achievement.findMany({
      orderBy: [{ category: "asc" }, { threshold: "asc" }],
    }),
    prisma.userAchievement.findMany({
      where: { userId },
      select: { achievementId: true, unlockedAt: true },
    }),
  ]);

  const unlockById = new Map(unlocks.map((row) => [row.achievementId, row.unlockedAt]));

  return achievements.map((achievement) => {
    const currentValue = getAchievementCurrentValue(achievement, stats);
    const unlockedAt = unlockById.get(achievement.id) ?? null;
    const progress =
      achievement.threshold <= 0
        ? 1
        : Math.min(1, Math.max(0, currentValue / achievement.threshold));

    return {
      id: achievement.id,
      code: achievement.code,
      title: achievement.title,
      description: achievement.description,
      icon: achievement.icon,
      category: achievement.category,
      threshold: achievement.threshold,
      isUnlocked: unlockedAt !== null,
      unlockedAt,
      progress,
      currentValue,
    };
  });
}

function buildLeaderboardEntry(params: {
  rank: number;
  userId: string;
  name: string;
  totalXp: number;
  weeklyXp: number;
  currentStreak: number;
  currentUserId: string;
}): LeaderboardEntry {
  return {
    rank: params.rank,
    userId: params.userId,
    name: params.name,
    totalXp: params.totalXp,
    weeklyXp: params.weeklyXp,
    currentStreak: params.currentStreak,
    isCurrentUser: params.userId === params.currentUserId,
  };
}

function rankStudentsByXp(
  students: Array<{ id: string; name: string; totalXp: number; currentStreak: number }>,
  weeklyXpByUser: Map<string, number>,
  currentUserId: string,
  mode: "overall" | "weekly",
): LeaderboardBoard {
  const scored = students.map((student) => ({
    ...student,
    weeklyXp: weeklyXpByUser.get(student.id) ?? 0,
  }));

  scored.sort((a, b) => {
    if (mode === "overall") {
      if (b.totalXp !== a.totalXp) return b.totalXp - a.totalXp;
      if (b.currentStreak !== a.currentStreak) return b.currentStreak - a.currentStreak;
      return a.name.localeCompare(b.name, "fa");
    }
    if (b.weeklyXp !== a.weeklyXp) return b.weeklyXp - a.weeklyXp;
    if (b.totalXp !== a.totalXp) return b.totalXp - a.totalXp;
    return a.name.localeCompare(b.name, "fa");
  });

  const ranked = scored.map((student, index) =>
    buildLeaderboardEntry({
      rank: index + 1,
      userId: student.id,
      name: student.name,
      totalXp: student.totalXp,
      weeklyXp: student.weeklyXp,
      currentStreak: student.currentStreak,
      currentUserId,
    }),
  );

  const currentUser = ranked.find((entry) => entry.userId === currentUserId) ?? null;
  const entries = ranked.slice(0, LEADERBOARD_LIMIT);

  return { entries, currentUser };
}

export async function getLeaderboardData(currentUserId: string): Promise<LeaderboardData> {
  const weekSince = new Date(Date.now() - 7 * MS_PER_DAY);

  const [students, weeklyRows] = await Promise.all([
    prisma.user.findMany({
      where: { role: Role.STUDENT },
      select: {
        id: true,
        name: true,
        totalXp: true,
        currentStreak: true,
      },
    }),
    prisma.quizResult.groupBy({
      by: ["userId"],
      where: {
        xpAwarded: true,
        completedAt: { gte: weekSince },
        user: { role: Role.STUDENT },
      },
      _sum: { xpEarned: true },
    }),
  ]);

  const weeklyXpByUser = new Map(
    weeklyRows.map((row) => [row.userId, row._sum.xpEarned ?? 0] as const),
  );

  return {
    overall: rankStudentsByXp(students, weeklyXpByUser, currentUserId, "overall"),
    weekly: rankStudentsByXp(students, weeklyXpByUser, currentUserId, "weekly"),
  };
}

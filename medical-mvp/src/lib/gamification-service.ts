import type { Prisma } from "@prisma/client";

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

type AwardUpdateRow = {
  currentStreak: number;
  streakMaintained: boolean;
};

const BASE_COMPLETION_XP = 10;
const HIGH_ACCURACY_BONUS = 5;
const REMEDIAL_BONUS = 15;
const HIGH_ACCURACY_THRESHOLD = 0.8;

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
  prismaTx: PrismaTx,
): Promise<boolean> {
  const claimed = await prismaTx.$queryRaw<Array<{ id: string }>>`
    UPDATE "QuizResult"
    SET "xpAwarded" = true
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

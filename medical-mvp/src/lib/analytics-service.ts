import { ProgressStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUnifiedWeakCategories } from "@/lib/unified-analytics";

export type CategoryAccuracy = {
  categoryId: string;
  name: string;
  slug: string;
  accuracy: number;
  attempts: number;
};

export type StudentPerformanceStats = {
  overallAccuracy: number;
  categoryAccuracy: CategoryAccuracy[];
  weakAreas: CategoryAccuracy[];
  totalAttempts: number;
};

export type PerformanceDateRange = {
  since?: Date;
  until?: Date;
};

export type PerformanceTrend = "improving" | "stable" | "declining" | "insufficient_data";

export type WeeklyPerformanceContext = {
  thisWeek: StudentPerformanceStats;
  priorWeek: StudentPerformanceStats;
  trend: PerformanceTrend;
  topImprovedCategory: { name: string; delta: number } | null;
};

export type AnalyticsOverview = {
  totalCasesCompleted: number;
  totalQuestionsAnswered: number;
  overallAccuracy: number;
  currentStreak: number;
  totalFlashcardsReviewed: number;
};

export type CategoryBreakdownItem = {
  categoryId: string;
  name: string;
  slug: string;
  totalAnswered: number;
  correctAnswers: number;
  accuracy: number;
  attempts: number;
};

export type AccuracyTrendPoint = {
  date: string;
  label: string;
  accuracy: number;
  questionsAnswered: number;
  correctAnswers: number;
  mistakesCreated: number;
};

export type UserAnalyticsData = {
  overview: AnalyticsOverview;
  categoryBreakdown: CategoryBreakdownItem[];
  accuracyTrend: AccuracyTrendPoint[];
  needsFocus: CategoryBreakdownItem[];
  mastered: CategoryBreakdownItem[];
};

const WEAK_AREA_THRESHOLD = 0.6;
const NEEDS_FOCUS_THRESHOLD = 0.5;
const MASTERED_THRESHOLD = 0.75;
const TREND_THRESHOLD = 0.03;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const TREND_DAYS = 30;

function computeAccuracy(scoreSum: number, totalSum: number): number {
  return totalSum > 0 ? scoreSum / totalSum : 0;
}

function buildCompletedAtFilter(range?: PerformanceDateRange) {
  if (!range?.since && !range?.until) {
    return undefined;
  }

  return {
    ...(range.since ? { gte: range.since } : {}),
    ...(range.until ? { lt: range.until } : {}),
  };
}

export function computePerformanceTrend(
  thisWeekAccuracy: number,
  priorWeekAccuracy: number,
  thisWeekAttempts: number,
  priorWeekAttempts: number,
): PerformanceTrend {
  if (thisWeekAttempts === 0 && priorWeekAttempts === 0) {
    return "insufficient_data";
  }

  if (thisWeekAttempts === 0 || priorWeekAttempts === 0) {
    return "insufficient_data";
  }

  const delta = thisWeekAccuracy - priorWeekAccuracy;

  if (delta >= TREND_THRESHOLD) {
    return "improving";
  }

  if (delta <= -TREND_THRESHOLD) {
    return "declining";
  }

  return "stable";
}

export function findTopImprovedCategory(
  thisWeek: StudentPerformanceStats,
  priorWeek: StudentPerformanceStats,
): { name: string; delta: number } | null {
  const priorByCategory = new Map(
    priorWeek.categoryAccuracy.map((category) => [category.categoryId, category]),
  );

  let topImproved: { name: string; delta: number } | null = null;

  for (const category of thisWeek.categoryAccuracy) {
    const priorCategory = priorByCategory.get(category.categoryId);
    if (!priorCategory || category.attempts < 1 || priorCategory.attempts < 1) {
      continue;
    }

    const delta = category.accuracy - priorCategory.accuracy;
    if (delta <= 0) {
      continue;
    }

    if (!topImproved || delta > topImproved.delta) {
      topImproved = { name: category.name, delta };
    }
  }

  return topImproved;
}

export function getWeeklyDateRanges(now = new Date()): {
  thisWeek: PerformanceDateRange;
  priorWeek: PerformanceDateRange;
} {
  const thisWeekSince = new Date(now.getTime() - 7 * MS_PER_DAY);
  const priorWeekSince = new Date(now.getTime() - 14 * MS_PER_DAY);

  return {
    thisWeek: { since: thisWeekSince, until: now },
    priorWeek: { since: priorWeekSince, until: thisWeekSince },
  };
}

export function getLast30DaysRange(now = new Date()): PerformanceDateRange {
  const endDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startDay = new Date(endDay);
  startDay.setUTCDate(startDay.getUTCDate() - (TREND_DAYS - 1));

  return {
    since: startDay,
    until: new Date(endDay.getTime() + MS_PER_DAY),
  };
}

function toUtcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatFaDayLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString("fa-IR", {
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function bucketAccuracyByDay(
  quizRows: Array<{ score: number; totalQuestions: number; completedAt: Date }>,
  mistakeRows: Array<{ createdAt: Date }>,
  now = new Date(),
): AccuracyTrendPoint[] {
  const endDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const buckets = new Map<
    string,
    { scoreSum: number; totalSum: number; mistakesCreated: number }
  >();

  for (let i = TREND_DAYS - 1; i >= 0; i -= 1) {
    const cursor = new Date(endDay);
    cursor.setUTCDate(endDay.getUTCDate() - i);
    buckets.set(toUtcDateKey(cursor), { scoreSum: 0, totalSum: 0, mistakesCreated: 0 });
  }

  for (const row of quizRows) {
    const key = toUtcDateKey(row.completedAt);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.scoreSum += row.score;
    bucket.totalSum += row.totalQuestions;
  }

  for (const row of mistakeRows) {
    const key = toUtcDateKey(row.createdAt);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.mistakesCreated += 1;
  }

  return [...buckets.entries()].map(([date, bucket]) => ({
    date,
    label: formatFaDayLabel(date),
    accuracy: computeAccuracy(bucket.scoreSum, bucket.totalSum),
    questionsAnswered: bucket.totalSum,
    correctAnswers: bucket.scoreSum,
    mistakesCreated: bucket.mistakesCreated,
  }));
}

export function classifyCategoryStrength(
  categories: CategoryBreakdownItem[],
): { needsFocus: CategoryBreakdownItem[]; mastered: CategoryBreakdownItem[] } {
  const withAttempts = categories.filter((category) => category.attempts >= 1);

  return {
    needsFocus: withAttempts.filter((category) => category.accuracy < NEEDS_FOCUS_THRESHOLD),
    mastered: withAttempts.filter((category) => category.accuracy > MASTERED_THRESHOLD),
  };
}

export async function getStudentPerformanceStats(
  userId: string,
  range?: PerformanceDateRange,
): Promise<StudentPerformanceStats> {
  const completedAt = buildCompletedAtFilter(range);
  const where = {
    userId,
    ...(completedAt ? { completedAt } : {}),
  };

  const [overallAgg, byCase, totalAttempts] = await Promise.all([
    prisma.quizResult.aggregate({
      where,
      _sum: { score: true, totalQuestions: true },
    }),
    prisma.quizResult.groupBy({
      by: ["caseId"],
      where,
      _sum: { score: true, totalQuestions: true },
      _count: { id: true },
    }),
    prisma.quizResult.count({ where }),
  ]);

  const overallScore = overallAgg._sum.score ?? 0;
  const overallTotal = overallAgg._sum.totalQuestions ?? 0;
  const overallAccuracy = computeAccuracy(overallScore, overallTotal);

  if (byCase.length === 0) {
    return { overallAccuracy, categoryAccuracy: [], weakAreas: [], totalAttempts };
  }

  const caseIds = byCase.map((row) => row.caseId);
  const cases = await prisma.case.findMany({
    where: { id: { in: caseIds } },
    select: {
      id: true,
      category: { select: { id: true, name: true, slug: true } },
    },
  });

  const categoryByCaseId = new Map(
    cases.map((kase) => [kase.id, kase.category]),
  );

  const categoryBuckets = new Map<
    string,
    { name: string; slug: string; scoreSum: number; totalSum: number; attempts: number }
  >();

  for (const row of byCase) {
    const category = categoryByCaseId.get(row.caseId);
    if (!category) continue;

    const entry = categoryBuckets.get(category.id) ?? {
      name: category.name,
      slug: category.slug,
      scoreSum: 0,
      totalSum: 0,
      attempts: 0,
    };

    entry.scoreSum += row._sum.score ?? 0;
    entry.totalSum += row._sum.totalQuestions ?? 0;
    entry.attempts += row._count.id;
    categoryBuckets.set(category.id, entry);
  }

  const categoryAccuracy: CategoryAccuracy[] = [...categoryBuckets.entries()]
    .map(([categoryId, bucket]) => ({
      categoryId,
      name: bucket.name,
      slug: bucket.slug,
      accuracy: computeAccuracy(bucket.scoreSum, bucket.totalSum),
      attempts: bucket.attempts,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fa"));

  const weakAreas = categoryAccuracy.filter((c) => c.accuracy < WEAK_AREA_THRESHOLD);

  return { overallAccuracy, categoryAccuracy, weakAreas, totalAttempts };
}

export async function getWeeklyPerformanceContext(
  userId: string,
  now = new Date(),
): Promise<WeeklyPerformanceContext> {
  const { thisWeek: thisWeekRange, priorWeek: priorWeekRange } = getWeeklyDateRanges(now);

  const [thisWeek, priorWeek] = await Promise.all([
    getStudentPerformanceStats(userId, thisWeekRange),
    getStudentPerformanceStats(userId, priorWeekRange),
  ]);

  const trend = computePerformanceTrend(
    thisWeek.overallAccuracy,
    priorWeek.overallAccuracy,
    thisWeek.totalAttempts,
    priorWeek.totalAttempts,
  );

  const topImprovedCategory = findTopImprovedCategory(thisWeek, priorWeek);

  return {
    thisWeek,
    priorWeek,
    trend,
    topImprovedCategory,
  };
}

export async function isCategoryWeakForUser(userId: string, categoryId: string): Promise<boolean> {
  const weakCategories = await getUnifiedWeakCategories(userId);
  return weakCategories.some((area) => area.categoryId === categoryId);
}

export async function getUserAnalyticsData(
  userId: string,
  now = new Date(),
): Promise<UserAnalyticsData> {
  const trendRange = getLast30DaysRange(now);
  const completedAt = buildCompletedAtFilter(trendRange);

  const [
    user,
    totalCasesCompleted,
    overallAgg,
    byCase,
    totalFlashcardsReviewed,
    recentQuizRows,
    recentMistakes,
  ] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { currentStreak: true },
    }),
    prisma.userProgress.count({
      where: { userId, status: ProgressStatus.COMPLETED },
    }),
    prisma.quizResult.aggregate({
      where: { userId },
      _sum: { score: true, totalQuestions: true },
    }),
    prisma.quizResult.groupBy({
      by: ["caseId"],
      where: { userId },
      _sum: { score: true, totalQuestions: true },
      _count: { id: true },
    }),
    prisma.userFlashcardProgress.count({
      where: { userId, lastReviewedAt: { not: null } },
    }),
    prisma.quizResult.findMany({
      where: {
        userId,
        ...(completedAt ? { completedAt } : {}),
      },
      select: { score: true, totalQuestions: true, completedAt: true },
    }),
    prisma.questionMistake.findMany({
      where: {
        userId,
        createdAt: {
          ...(trendRange.since ? { gte: trendRange.since } : {}),
          ...(trendRange.until ? { lt: trendRange.until } : {}),
        },
      },
      select: { createdAt: true },
    }),
  ]);

  const overallScore = overallAgg._sum.score ?? 0;
  const overallTotal = overallAgg._sum.totalQuestions ?? 0;

  const overview: AnalyticsOverview = {
    totalCasesCompleted,
    totalQuestionsAnswered: overallTotal,
    overallAccuracy: computeAccuracy(overallScore, overallTotal),
    currentStreak: user.currentStreak,
    totalFlashcardsReviewed,
  };

  let categoryBreakdown: CategoryBreakdownItem[] = [];

  if (byCase.length > 0) {
    const caseIds = byCase.map((row) => row.caseId);
    const cases = await prisma.case.findMany({
      where: { id: { in: caseIds } },
      select: {
        id: true,
        category: { select: { id: true, name: true, slug: true } },
      },
    });

    const categoryByCaseId = new Map(cases.map((kase) => [kase.id, kase.category]));
    const categoryBuckets = new Map<
      string,
      { name: string; slug: string; scoreSum: number; totalSum: number; attempts: number }
    >();

    for (const row of byCase) {
      const category = categoryByCaseId.get(row.caseId);
      if (!category) continue;

      const entry = categoryBuckets.get(category.id) ?? {
        name: category.name,
        slug: category.slug,
        scoreSum: 0,
        totalSum: 0,
        attempts: 0,
      };

      entry.scoreSum += row._sum.score ?? 0;
      entry.totalSum += row._sum.totalQuestions ?? 0;
      entry.attempts += row._count.id;
      categoryBuckets.set(category.id, entry);
    }

    categoryBreakdown = [...categoryBuckets.entries()]
      .map(([categoryId, bucket]) => ({
        categoryId,
        name: bucket.name,
        slug: bucket.slug,
        totalAnswered: bucket.totalSum,
        correctAnswers: bucket.scoreSum,
        accuracy: computeAccuracy(bucket.scoreSum, bucket.totalSum),
        attempts: bucket.attempts,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "fa"));
  }

  const accuracyTrend = bucketAccuracyByDay(recentQuizRows, recentMistakes, now);
  const { needsFocus, mastered } = classifyCategoryStrength(categoryBreakdown);

  return {
    overview,
    categoryBreakdown,
    accuracyTrend,
    needsFocus,
    mastered,
  };
}

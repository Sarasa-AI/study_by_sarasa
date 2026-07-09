import { prisma } from "@/lib/prisma";

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

const WEAK_AREA_THRESHOLD = 0.6;
const TREND_THRESHOLD = 0.03;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

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
  const stats = await getStudentPerformanceStats(userId);
  return stats.weakAreas.some((area) => area.categoryId === categoryId);
}

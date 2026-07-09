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
};

const WEAK_AREA_THRESHOLD = 0.6;

function computeAccuracy(scoreSum: number, totalSum: number): number {
  return totalSum > 0 ? scoreSum / totalSum : 0;
}

export async function getStudentPerformanceStats(
  userId: string,
): Promise<StudentPerformanceStats> {
  const [overallAgg, byCase] = await Promise.all([
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
  ]);

  const overallScore = overallAgg._sum.score ?? 0;
  const overallTotal = overallAgg._sum.totalQuestions ?? 0;
  const overallAccuracy = computeAccuracy(overallScore, overallTotal);

  if (byCase.length === 0) {
    return { overallAccuracy, categoryAccuracy: [], weakAreas: [] };
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

  return { overallAccuracy, categoryAccuracy, weakAreas };
}

export async function isCategoryWeakForUser(userId: string, categoryId: string): Promise<boolean> {
  const stats = await getStudentPerformanceStats(userId);
  return stats.weakAreas.some((area) => area.categoryId === categoryId);
}

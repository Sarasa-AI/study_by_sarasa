"use server";

import { ContentStatus, ExamSessionStatus } from "@prisma/client";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withServerAction } from "@/lib/server-action";
import { getUnifiedWeakCategories } from "@/lib/unified-analytics";

const RECOMMENDATION_LIMIT = 6;

export type RecommendedCase = {
  id: string;
  title: string;
  category: string;
  categoryId: string;
  chiefComplaint: string;
  reason: string;
  source: "adaptive" | "fallback";
};

export type AdaptiveRecommendationsResult =
  | { success: true; data: RecommendedCase[]; mode: "adaptive" | "fallback" }
  | { success: false; message: string };

type CaseCandidate = {
  id: string;
  title: string;
  chiefComplaint: string;
  createdAt: Date;
  categoryId: string;
  category: { id: string; name: string };
};

async function fetchFallbackCases(): Promise<RecommendedCase[]> {
  const cases = await prisma.case.findMany({
    where: { status: ContentStatus.PUBLISHED },
    select: {
      id: true,
      title: true,
      chiefComplaint: true,
      categoryId: true,
      createdAt: true,
      category: { select: { id: true, name: true } },
      _count: { select: { quizResults: true } },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 40,
  });

  const sorted = [...cases].sort((a, b) => {
    const popularityDiff = b._count.quizResults - a._count.quizResults;
    if (popularityDiff !== 0) return popularityDiff;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return sorted.slice(0, RECOMMENDATION_LIMIT).map((kase) => ({
    id: kase.id,
    title: kase.title,
    category: kase.category.name,
    categoryId: kase.categoryId,
    chiefComplaint: kase.chiefComplaint,
    reason: "از کیس‌های پربازدید و جدید کتابخانه",
    source: "fallback" as const,
  }));
}

/**
 * Cases the user has fully mastered (all exam answers correct for that case,
 * or at least one perfect quiz result). Still-incorrect / partial attempts remain eligible.
 */
async function getMasteredAndNeedsPracticeCaseIds(userId: string): Promise<{
  masteredCaseIds: Set<string>;
  needsPracticeCaseIds: Set<string>;
}> {
  const [examAnswers, quizResults] = await Promise.all([
    prisma.examAnswer.findMany({
      where: {
        session: {
          userId,
          status: ExamSessionStatus.COMPLETED,
        },
      },
      select: {
        isCorrect: true,
        question: { select: { caseId: true } },
      },
    }),
    prisma.quizResult.findMany({
      where: { userId },
      select: {
        caseId: true,
        score: true,
        totalQuestions: true,
      },
    }),
  ]);

  const examIncorrect = new Set<string>();
  const examAttempted = new Set<string>();
  for (const answer of examAnswers) {
    const caseId = answer.question.caseId;
    examAttempted.add(caseId);
    if (!answer.isCorrect) {
      examIncorrect.add(caseId);
    }
  }

  const quizPerfect = new Set<string>();
  const quizNeedsPractice = new Set<string>();
  for (const result of quizResults) {
    if (result.score === result.totalQuestions && result.totalQuestions > 0) {
      quizPerfect.add(result.caseId);
    } else {
      quizNeedsPractice.add(result.caseId);
    }
  }

  const masteredCaseIds = new Set<string>();
  for (const caseId of examAttempted) {
    if (!examIncorrect.has(caseId)) {
      masteredCaseIds.add(caseId);
    }
  }
  for (const caseId of quizPerfect) {
    masteredCaseIds.add(caseId);
  }

  const needsPracticeCaseIds = new Set<string>([
    ...examIncorrect,
    ...quizNeedsPractice,
  ]);

  // A perfect quiz (or fully-correct exam) overrides prior needs-practice for eligibility ranking.
  for (const caseId of masteredCaseIds) {
    needsPracticeCaseIds.delete(caseId);
  }

  return { masteredCaseIds, needsPracticeCaseIds };
}

export async function getAdaptiveRecommendations(): Promise<AdaptiveRecommendationsResult> {
  const user = await getSessionUser();
  if (!user?.id) {
    return { success: false, message: "برای مشاهده پیشنهادها باید وارد شوید" };
  }

  return withServerAction(
    { operation: "recommendations.adaptive", userId: user.id },
    async () => {
      const weakCategories = await getUnifiedWeakCategories(user.id);

      if (weakCategories.length === 0) {
        const fallback = await fetchFallbackCases();
        return { success: true as const, data: fallback, mode: "fallback" as const };
      }

      const weakCategoryIds = weakCategories.map((c) => c.categoryId);
      const weakNameById = new Map(weakCategories.map((c) => [c.categoryId, c.name]));

      const { masteredCaseIds, needsPracticeCaseIds } =
        await getMasteredAndNeedsPracticeCaseIds(user.id);

      const masteredIds = [...masteredCaseIds];

      const eligibilityFilter =
        masteredIds.length === 0
          ? {}
          : { id: { notIn: masteredIds } };

      const candidates: CaseCandidate[] = await prisma.case.findMany({
        where: {
          status: ContentStatus.PUBLISHED,
          categoryId: { in: weakCategoryIds },
          ...eligibilityFilter,
        },
        select: {
          id: true,
          title: true,
          chiefComplaint: true,
          createdAt: true,
          categoryId: true,
          category: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 40,
      });

      if (candidates.length === 0) {
        const fallback = await fetchFallbackCases();
        return { success: true as const, data: fallback, mode: "fallback" as const };
      }

      const ranked = [...candidates].sort((a, b) => {
        const aNeeds = needsPracticeCaseIds.has(a.id) ? 1 : 0;
        const bNeeds = needsPracticeCaseIds.has(b.id) ? 1 : 0;
        if (bNeeds !== aNeeds) return bNeeds - aNeeds;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });

      const data: RecommendedCase[] = ranked.slice(0, RECOMMENDATION_LIMIT).map((kase) => {
        const categoryName = weakNameById.get(kase.categoryId) ?? kase.category.name;
        return {
          id: kase.id,
          title: kase.title,
          category: categoryName,
          categoryId: kase.categoryId,
          chiefComplaint: kase.chiefComplaint,
          reason: `بر اساس عملکرد یکپارچه آزمون و کوییز در دسته‌بندی ${categoryName}`,
          source: "adaptive" as const,
        };
      });

      return { success: true as const, data, mode: "adaptive" as const };
    },
  );
}

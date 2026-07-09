"use server";

import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { z, type ZodError } from "zod";
import { isCategoryWeakForUser } from "@/lib/analytics-service";
import { formatZodError } from "@/lib/case-schema";
import { awardQuizCompletion, claimQuizXpAward } from "@/lib/gamification-service";
import { getLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  gradeQuiz,
  validateQuizAnswers,
  ZERO_XP,
  type AnswerMap,
  type GamificationSummary,
  type QuizActionResult,
  type StreakResult,
  type XpResult,
} from "@/lib/quiz";
import { runWithRequestId } from "@/lib/request-context";

async function resolveUserId(): Promise<string | null> {
  const session = await getServerSession();
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

function handleQuizActionError(error: unknown): QuizActionResult {
  if (error instanceof z.ZodError) {
    return { success: false, message: formatZodError(error as ZodError) };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2003") {
      return { success: false, message: "داده‌های آزمون معتبر نیست" };
    }
    return { success: false, message: "خطا در ذخیره‌سازی نتیجه آزمون" };
  }

  return { success: false, message: "خطای سرور" };
}

function buildSkippedGamification(currentStreak: number): {
  xp: XpResult;
  streak: StreakResult;
  isNewStreakMilestone: boolean;
  gamification: GamificationSummary;
} {
  return {
    xp: ZERO_XP,
    streak: { newStreak: currentStreak, streakBroken: false, isNewMilestone: false },
    isNewStreakMilestone: false,
    gamification: {
      xpEarned: 0,
      newStreak: currentStreak,
      streakMaintained: true,
    },
  };
}

function buildAwardGamification(award: {
  xpEarned: number;
  currentStreak: number;
  streakMaintained: boolean;
}): {
  xp: XpResult;
  streak: StreakResult;
  isNewStreakMilestone: boolean;
  gamification: GamificationSummary;
} {
  return {
    xp: {
      basePoints: award.xpEarned,
      speedBonus: 0,
      streakBonus: 0,
      total: award.xpEarned,
    },
    streak: {
      newStreak: award.currentStreak,
      streakBroken: !award.streakMaintained,
      isNewMilestone: false,
    },
    isNewStreakMilestone: false,
    gamification: {
      xpEarned: award.xpEarned,
      newStreak: award.currentStreak,
      streakMaintained: award.streakMaintained,
    },
  };
}

export async function submitQuizAction(
  caseId: string,
  answers: AnswerMap,
  timeSpent?: number,
): Promise<QuizActionResult> {
  const userId = await resolveUserId();
  if (!userId) {
    return { success: false, message: "برای شرکت در آزمون باید وارد شوید" };
  }

  return runWithRequestId(async () => {
    const logger = getLogger();

    try {
      logger.info(
        {
          event: "quiz.submit.start",
          userId,
          caseId,
        },
        "Quiz submission started",
      );

      const kase = await prisma.case.findUnique({
        where: { id: caseId },
        include: {
          questions: {
            orderBy: { orderIndex: "asc" },
            select: {
              id: true,
              correctAnswer: true,
              explanation: true,
              points: true,
            },
          },
        },
      });

      if (!kase) {
        return { success: false, message: "کیس یافت نشد" };
      }

      if (kase.questions.length === 0) {
        return { success: false, message: "سوالی برای این کیس ثبت نشده است" };
      }

      const questionIds = kase.questions.map((question) => question.id);
      validateQuizAnswers(questionIds, answers);

      const { score, total, percent, feedback } = gradeQuiz(kase.questions, answers);
      const accuracy = total > 0 ? score / total : 0;
      const completionTimeSeconds = timeSpent ?? null;
      const isRemedial = await isCategoryWeakForUser(userId, kase.categoryId);

      const gamification = await prisma.$transaction(
        async (tx) => {
          const priorXpAwarded = await tx.quizResult.findFirst({
            where: { userId, caseId, xpAwarded: true },
            select: { id: true },
          });

          const quizResult = await tx.quizResult.create({
            data: {
              userId,
              caseId,
              score,
              totalQuestions: total,
              timeSpent: completionTimeSeconds,
              answers: answers as Prisma.InputJsonValue,
            },
          });

          await tx.userProgress.upsert({
            where: { userId_caseId: { userId, caseId } },
            update: { status: "COMPLETED", completedAt: new Date() },
            create: {
              userId,
              caseId,
              status: "COMPLETED",
              lastStep: 999,
              completedAt: new Date(),
            },
          });

          if (priorXpAwarded) {
            const user = await tx.user.findUniqueOrThrow({
              where: { id: userId },
              select: { currentStreak: true },
            });
            return {
              quizResult,
              ...buildSkippedGamification(user.currentStreak),
            };
          }

          const claimed = await claimQuizXpAward(userId, caseId, quizResult.id, tx);
          if (!claimed) {
            const user = await tx.user.findUniqueOrThrow({
              where: { id: userId },
              select: { currentStreak: true },
            });
            return {
              quizResult,
              ...buildSkippedGamification(user.currentStreak),
            };
          }

          const award = await awardQuizCompletion(userId, accuracy, isRemedial, tx);

          return {
            quizResult,
            ...buildAwardGamification(award),
          };
        },
        {
          maxWait: 5000,
          timeout: 15000,
        },
      );

      logger.info(
        {
          event: "quiz.submit.complete",
          userId,
          caseId,
          accuracy,
          xpEarned: gamification.gamification.xpEarned,
        },
        "Quiz submission completed",
      );

      return {
        success: true,
        message: "آزمون با موفقیت ثبت شد",
        data: {
          resultId: gamification.quizResult.id,
          score,
          total,
          percent,
          feedback,
          xp: gamification.xp,
          streak: gamification.streak,
          isNewStreakMilestone: gamification.isNewStreakMilestone,
          gamification: gamification.gamification,
        },
      };
    } catch (error) {
      logger.error(
        {
          event: "quiz.submit.failed",
          userId,
          caseId,
          errorType: error instanceof Error ? error.name : "UnknownError",
        },
        "Quiz submission failed",
      );
      return handleQuizActionError(error);
    }
  }, { operation: "quiz-submit", userId });
}

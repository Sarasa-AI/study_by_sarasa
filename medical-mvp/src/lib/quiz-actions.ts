"use server";

import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { z, type ZodError } from "zod";
import { formatZodError } from "@/lib/case-schema";
import { prisma } from "@/lib/prisma";
import {
  calculateQuizXp,
  calculateStreak,
  gradeQuiz,
  validateQuizAnswers,
  ZERO_XP,
  type AnswerMap,
  type QuizActionResult,
  type StreakResult,
  type XpResult,
} from "@/lib/quiz";

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

function buildSkippedGamification(
  currentStreak: number,
): { xp: XpResult; streak: StreakResult; isNewStreakMilestone: boolean } {
  return {
    xp: ZERO_XP,
    streak: { newStreak: currentStreak, streakBroken: false, isNewMilestone: false },
    isNewStreakMilestone: false,
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

  try {
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
    const correctCount = feedback.filter((item) => item.isCorrect).length;
    const completionTimeSeconds = timeSpent ?? null;

    const gamification = await prisma.$transaction(async (tx) => {
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

      const now = new Date();
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          totalXp: true,
          currentStreak: true,
          longestStreak: true,
          lastQuizCompletedAt: true,
        },
      });

      const streak = calculateStreak(user.lastQuizCompletedAt, now, user.currentStreak);
      const xp = calculateQuizXp({
        correctCount,
        completionTimeSeconds,
        currentStreak: streak.newStreak,
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          totalXp: user.totalXp + xp.total,
          currentStreak: streak.newStreak,
          longestStreak: Math.max(user.longestStreak, streak.newStreak),
          lastQuizCompletedAt: now,
        },
      });

      await tx.quizResult.update({
        where: { id: quizResult.id },
        data: { xpAwarded: true },
      });

      return {
        quizResult,
        xp,
        streak,
        isNewStreakMilestone: streak.isNewMilestone,
      };
    });

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
      },
    };
  } catch (error) {
    return handleQuizActionError(error);
  }
}

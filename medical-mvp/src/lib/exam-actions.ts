"use server";

import { Prisma } from "@prisma/client";
import { z, type ZodError } from "zod";
import { getSessionUser } from "@/lib/auth";
import { answerOptions, formatZodError } from "@/lib/case-schema";
import { generateExamQuiz, type ExamQuizItem } from "@/lib/exam-service";
import { getLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  gradeQuiz,
  parseDistractorRationales,
  ZERO_XP,
  type AnswerMap,
  type GamificationSummary,
  type QuizResultData,
  type StreakResult,
  type XpResult,
} from "@/lib/quiz";
import { withServerAction } from "@/lib/server-action";

const QUESTION_COUNTS = [10, 20, 50] as const;
const TIME_PRESETS = [15, 30, 60] as const;

const startExamSchema = z.object({
  questionCount: z.number().refine((n) => (QUESTION_COUNTS as readonly number[]).includes(n), {
    message: "تعداد سؤالات معتبر نیست",
  }),
  categoryIds: z.array(z.string().min(1)).optional(),
  timeLimitMinutes: z.number().positive(),
  usePerQuestionTime: z.boolean().optional(),
});

export type StartExamActionResult =
  | {
      success: true;
      message: string;
      items: ExamQuizItem[];
      questionIds: string[];
      timeLimitMinutes: number;
    }
  | { success: false; message: string };

export type ExamSubmitResultData = QuizResultData & {
  timeSpent: number;
  mistakeCount: number;
};

export type ExamActionResult =
  | { success: true; message: string; data: ExamSubmitResultData }
  | { success: false; message: string };

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

function handleExamActionError(error: unknown): { success: false; message: string } {
  if (error instanceof z.ZodError) {
    return { success: false, message: formatZodError(error as ZodError) };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return { success: false, message: "خطا در ذخیره‌سازی نتیجه آزمون" };
  }

  return { success: false, message: "خطای سرور" };
}

function sanitizeExamAnswers(questionIds: string[], answers: AnswerMap): AnswerMap {
  const allowed = new Set(questionIds);
  const optionSet = new Set<string>(answerOptions);
  const sanitized: AnswerMap = {};

  for (const [questionId, value] of Object.entries(answers)) {
    if (!allowed.has(questionId)) continue;
    if (typeof value !== "string" || !optionSet.has(value)) continue;
    sanitized[questionId] = value;
  }

  return sanitized;
}

function resolveTimeLimitMinutes(
  questionCount: number,
  timeLimitMinutes: number,
  usePerQuestionTime?: boolean,
): number {
  if (usePerQuestionTime) {
    return Math.ceil(questionCount * 1.5);
  }

  if ((TIME_PRESETS as readonly number[]).includes(timeLimitMinutes)) {
    return timeLimitMinutes;
  }

  // Allow the computed per-question value when client already calculated it
  if (timeLimitMinutes === Math.ceil(questionCount * 1.5)) {
    return timeLimitMinutes;
  }

  throw new z.ZodError([
    {
      code: "custom",
      path: ["timeLimitMinutes"],
      message: "مدت زمان آزمون معتبر نیست",
    },
  ]);
}

export async function startExamAction(input: {
  questionCount: number;
  categoryIds?: string[];
  timeLimitMinutes: number;
  usePerQuestionTime?: boolean;
}): Promise<StartExamActionResult> {
  const user = await getSessionUser();
  if (!user?.id) {
    return { success: false, message: "برای شرکت در آزمون باید وارد شوید" };
  }

  return withServerAction(
    {
      operation: "exam-start",
      userId: user.id,
      input: {
        questionCount: input.questionCount,
        categoryIds: input.categoryIds,
        timeLimitMinutes: input.timeLimitMinutes,
        usePerQuestionTime: input.usePerQuestionTime,
      },
    },
    async () => {
    const logger = getLogger();

    try {
      const parsed = startExamSchema.parse(input);
      const timeLimitMinutes = resolveTimeLimitMinutes(
        parsed.questionCount,
        parsed.timeLimitMinutes,
        parsed.usePerQuestionTime,
      );

      const result = await generateExamQuiz(user.id, {
        questionCount: parsed.questionCount,
        categoryIds: parsed.categoryIds,
        timeLimitMinutes,
      });

      if (result.items.length === 0) {
        return {
          success: false,
          message: "سؤالی با فیلترهای انتخاب‌شده یافت نشد. دسته‌ها یا تعداد را تغییر دهید.",
        };
      }

      if (result.items.length < parsed.questionCount) {
        logger.info(
          {
            event: "exam.start.partial_pool",
            userId: user.id,
            requested: parsed.questionCount,
            available: result.items.length,
          },
          "Exam started with fewer questions than requested",
        );
      }

      logger.info(
        {
          event: "exam.start.complete",
          userId: user.id,
          questionCount: result.items.length,
          timeLimitMinutes,
        },
        "Exam started",
      );

      return {
        success: true,
        message: "آزمون آماده است",
        items: result.items,
        questionIds: result.items.map((item) => item.question.id),
        timeLimitMinutes: result.timeLimitMinutes,
      };
    } catch (error) {
      logger.error(
        {
          event: "exam.start.failed",
          userId: user.id,
          err:
            error instanceof Error
              ? { name: error.name, message: error.message, stack: error.stack }
              : { message: "UnknownError" },
        },
        "Exam start failed",
      );
      return handleExamActionError(error);
    }
  },
  );
}

export async function submitExamAction(
  questionIds: string[],
  answers: AnswerMap,
  timeSpent?: number,
): Promise<ExamActionResult> {
  const user = await getSessionUser();
  if (!user?.id) {
    return { success: false, message: "برای شرکت در آزمون باید وارد شوید" };
  }

  if (questionIds.length === 0) {
    return { success: false, message: "سوالی برای آزمون انتخاب نشده است" };
  }

  const userId = user.id;

  return withServerAction(
    {
      operation: "exam-submit",
      userId,
      input: { questionCount: questionIds.length, timeSpent },
    },
    async () => {
    const logger = getLogger();

    try {
      const uniqueIds = [...new Set(questionIds)];
      if (uniqueIds.length !== questionIds.length) {
        return { success: false, message: "شناسه سؤالات معتبر نیست" };
      }

      const questions = await prisma.question.findMany({
        where: {
          id: { in: questionIds },
          case: { status: "PUBLISHED" },
        },
        select: {
          id: true,
          correctAnswer: true,
          explanation: true,
          clinicalReasoning: true,
          distractorRationales: true,
          points: true,
        },
      });

      if (questions.length !== questionIds.length) {
        return { success: false, message: "برخی سؤالات یافت نشدند یا منتشر نشده‌اند" };
      }

      const questionById = new Map(questions.map((question) => [question.id, question]));
      const orderedQuestions = questionIds.map((id) => questionById.get(id)!);
      const sanitizedAnswers = sanitizeExamAnswers(questionIds, answers);

      const gradingQuestions = orderedQuestions.map((question) => ({
        id: question.id,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        clinicalReasoning: question.clinicalReasoning,
        distractorRationales: parseDistractorRationales(question.distractorRationales),
        points: question.points,
      }));

      const { score, total, percent, feedback } = gradeQuiz(gradingQuestions, sanitizedAnswers);
      const mistakeCount = feedback.filter((item) => !item.isCorrect).length;

      const dbUser = await prisma.$transaction(async (tx) => {
        for (const item of feedback) {
          if (!item.isCorrect) {
            await tx.questionMistake.upsert({
              where: {
                userId_questionId: { userId, questionId: item.questionId },
              },
              create: {
                userId,
                questionId: item.questionId,
                isResolved: false,
              },
              update: { isResolved: false },
            });
          } else {
            await tx.questionMistake.updateMany({
              where: {
                userId,
                questionId: item.questionId,
                isResolved: false,
              },
              data: { isResolved: true },
            });
          }
        }

        return tx.user.findUniqueOrThrow({
          where: { id: userId },
          select: { currentStreak: true },
        });
      });

      const gamification = buildSkippedGamification(dbUser.currentStreak);
      const spent = typeof timeSpent === "number" && timeSpent >= 0 ? Math.round(timeSpent) : 0;

      logger.info(
        {
          event: "exam.submit.complete",
          userId,
          questionCount: questionIds.length,
          score,
          total,
          timeSpent: spent,
          mistakeCount,
        },
        "Exam submission completed",
      );

      return {
        success: true,
        message: "آزمون با موفقیت ثبت شد",
        data: {
          resultId: "",
          score,
          total,
          percent,
          feedback,
          xp: gamification.xp,
          streak: gamification.streak,
          isNewStreakMilestone: gamification.isNewStreakMilestone,
          gamification: gamification.gamification,
          timeSpent: spent,
          mistakeCount,
        },
      };
    } catch (error) {
      logger.error(
        {
          event: "exam.submit.failed",
          userId,
          questionCount: questionIds.length,
          err:
            error instanceof Error
              ? { name: error.name, message: error.message, stack: error.stack }
              : { message: "UnknownError" },
        },
        "Exam submission failed",
      );
      return handleExamActionError(error);
    }
  },
  );
}

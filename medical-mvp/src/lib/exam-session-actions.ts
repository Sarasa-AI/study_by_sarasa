"use server";

import { ExamSessionStatus, Prisma } from "@prisma/client";
import { revalidateTag } from "next/cache";
import { z, type ZodError } from "zod";
import { getSessionUser } from "@/lib/auth";
import { answerOptions, formatZodError } from "@/lib/case-schema";
import { recordExamAnswerXP, updateStreak } from "@/lib/gamification-actions";
import { getLogger, logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { withServerAction } from "@/lib/server-action";

export type ExamQuestionPublic = {
  id: string;
  questionText: string;
  options: { A: string; B: string; C: string; D: string };
  orderIndex: number;
  mediaUrl: string | null;
  chiefComplaint: string | null;
  patientInfo: string | null;
};

export type StartExamResult =
  | {
      success: true;
      message: string;
      sessionId: string;
      durationMinutes: number;
      questions: ExamQuestionPublic[];
    }
  | { success: false; message: string };

export type SubmitAnswerResult =
  | { success: true; message: string }
  | { success: false; message: string };

export type FinishExamResult =
  | {
      success: true;
      message: string;
      score: number;
      passed: boolean;
      passingScore: number;
      totalQuestions: number;
      correctCount: number;
    }
  | { success: false; message: string };

const startExamSchema = z.object({
  examId: z.string().min(1, "شناسه آزمون الزامی است"),
});

const submitAnswerSchema = z.object({
  sessionId: z.string().min(1, "شناسه جلسه الزامی است"),
  questionId: z.string().min(1, "شناسه سؤال الزامی است"),
  option: z.enum(answerOptions, {
    errorMap: () => ({ message: "گزینه انتخاب‌شده نامعتبر است" }),
  }),
});

const finishExamSchema = z.object({
  sessionId: z.string().min(1, "شناسه جلسه الزامی است"),
});

function handleExamSessionError(error: unknown): { success: false; message: string } {
  if (error instanceof z.ZodError) {
    return { success: false, message: formatZodError(error as ZodError) };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return { success: false, message: "خطا در ذخیره‌سازی جلسه آزمون" };
  }

  return { success: false, message: "خطای سرور" };
}

function toPublicQuestion(
  question: {
    id: string;
    questionText: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    case: {
      mediaUrl: string | null;
      mediaType: string | null;
      chiefComplaint: string;
      patientInfo: string;
    };
  },
  orderIndex: number,
): ExamQuestionPublic {
  const mediaUrl =
    question.case.mediaType === "IMAGE" || !question.case.mediaType
      ? question.case.mediaUrl
      : null;

  return {
    id: question.id,
    questionText: question.questionText,
    options: {
      A: question.optionA,
      B: question.optionB,
      C: question.optionC,
      D: question.optionD,
    },
    orderIndex,
    mediaUrl,
    chiefComplaint: question.case.chiefComplaint,
    patientInfo: question.case.patientInfo,
  };
}

export async function startExam(examId: string): Promise<StartExamResult> {
  const user = await getSessionUser();
  if (!user?.id) {
    return { success: false, message: "برای شرکت در آزمون باید وارد شوید" };
  }

  return withServerAction(
    { operation: "examSession.start", userId: user.id, input: { examId } },
    async () => {
      try {
        const parsed = startExamSchema.parse({ examId });

        const exam = await prisma.exam.findUnique({
          where: { id: parsed.examId },
          include: {
            questions: {
              orderBy: { orderIndex: "asc" },
              include: {
                question: {
                  select: {
                    id: true,
                    questionText: true,
                    optionA: true,
                    optionB: true,
                    optionC: true,
                    optionD: true,
                    case: {
                      select: {
                        mediaUrl: true,
                        mediaType: true,
                        chiefComplaint: true,
                        patientInfo: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

        if (!exam) {
          return { success: false, message: "آزمون یافت نشد" };
        }

        if (exam.questions.length === 0) {
          return { success: false, message: "این آزمون هنوز سؤالی ندارد" };
        }

        const session = await prisma.examSession.create({
          data: {
            userId: user.id,
            examId: exam.id,
            status: ExamSessionStatus.IN_PROGRESS,
          },
        });

        await updateStreak();

        return {
          success: true,
          message: "جلسه آزمون شروع شد",
          sessionId: session.id,
          durationMinutes: exam.durationMinutes,
          questions: exam.questions.map((eq) => toPublicQuestion(eq.question, eq.orderIndex)),
        };
      } catch (error) {
        logError(getLogger(), {
          event: "examSession.start.error",
          operation: "examSession.start",
          error,
        });
        return handleExamSessionError(error);
      }
    },
  );
}

export async function submitAnswer(
  sessionId: string,
  questionId: string,
  option: string,
): Promise<SubmitAnswerResult> {
  const user = await getSessionUser();
  if (!user?.id) {
    return { success: false, message: "برای ثبت پاسخ باید وارد شوید" };
  }

  return withServerAction(
    {
      operation: "examSession.submitAnswer",
      userId: user.id,
      input: { sessionId, questionId, option },
    },
    async () => {
      try {
        const parsed = submitAnswerSchema.parse({ sessionId, questionId, option });

        const session = await prisma.examSession.findFirst({
          where: { id: parsed.sessionId, userId: user.id },
          select: {
            id: true,
            status: true,
            examId: true,
          },
        });

        if (!session) {
          return { success: false, message: "جلسه آزمون یافت نشد" };
        }

        if (session.status !== ExamSessionStatus.IN_PROGRESS) {
          return { success: false, message: "این جلسه دیگر قابل ویرایش نیست" };
        }

        const examQuestion = await prisma.examQuestion.findUnique({
          where: {
            examId_questionId: {
              examId: session.examId,
              questionId: parsed.questionId,
            },
          },
          include: {
            question: { select: { id: true, correctAnswer: true } },
          },
        });

        if (!examQuestion) {
          return { success: false, message: "سؤال متعلق به این آزمون نیست" };
        }

        const isCorrect = examQuestion.question.correctAnswer === parsed.option;

        const answer = await prisma.examAnswer.upsert({
          where: {
            sessionId_questionId: {
              sessionId: session.id,
              questionId: parsed.questionId,
            },
          },
          create: {
            sessionId: session.id,
            questionId: parsed.questionId,
            selectedOption: parsed.option,
            isCorrect,
          },
          update: {
            selectedOption: parsed.option,
            isCorrect,
          },
        });

        if (isCorrect) {
          await recordExamAnswerXP(answer.id);
        }

        return { success: true, message: "پاسخ ذخیره شد" };
      } catch (error) {
        logError(getLogger(), {
          event: "examSession.submitAnswer.error",
          operation: "examSession.submitAnswer",
          error,
        });
        return handleExamSessionError(error);
      }
    },
  );
}

export async function finishExam(sessionId: string): Promise<FinishExamResult> {
  const user = await getSessionUser();
  if (!user?.id) {
    return { success: false, message: "برای پایان آزمون باید وارد شوید" };
  }

  return withServerAction(
    { operation: "examSession.finish", userId: user.id, input: { sessionId } },
    async () => {
      try {
        const parsed = finishExamSchema.parse({ sessionId });

        const session = await prisma.examSession.findFirst({
          where: { id: parsed.sessionId, userId: user.id },
          include: {
            exam: {
              select: {
                passingScore: true,
                questions: {
                  select: { questionId: true },
                },
              },
            },
            answers: {
              select: {
                questionId: true,
                isCorrect: true,
              },
            },
          },
        });

        if (!session) {
          return { success: false, message: "جلسه آزمون یافت نشد" };
        }

        const totalQuestions = session.exam.questions.length;
        const correctCount = session.answers.filter((a) => a.isCorrect).length;
        const score =
          totalQuestions === 0 ? 0 : Math.round((correctCount / totalQuestions) * 10000) / 100;
        const passed = score >= session.exam.passingScore;

        if (session.status === ExamSessionStatus.COMPLETED) {
          return {
            success: true,
            message: "آزمون قبلاً پایان یافته است",
            score: session.score ?? score,
            passed: (session.score ?? score) >= session.exam.passingScore,
            passingScore: session.exam.passingScore,
            totalQuestions,
            correctCount,
          };
        }

        if (session.status !== ExamSessionStatus.IN_PROGRESS) {
          return { success: false, message: "وضعیت جلسه برای پایان دادن معتبر نیست" };
        }

        await prisma.examSession.update({
          where: { id: session.id },
          data: {
            status: ExamSessionStatus.COMPLETED,
            completedAt: new Date(),
            score,
          },
        });

        revalidateTag("cohort-analytics");

        return {
          success: true,
          message: "آزمون با موفقیت پایان یافت",
          score,
          passed,
          passingScore: session.exam.passingScore,
          totalQuestions,
          correctCount,
        };
      } catch (error) {
        logError(getLogger(), {
          event: "examSession.finish.error",
          operation: "examSession.finish",
          error,
        });
        return handleExamSessionError(error);
      }
    },
  );
}

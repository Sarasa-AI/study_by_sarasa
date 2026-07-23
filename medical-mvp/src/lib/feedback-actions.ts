"use server";

import { FeedbackReason, FeedbackStatus, Role } from "@prisma/client";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import {
  submitQuestionFeedback,
  updateFeedbackStatus,
} from "@/lib/feedback-service";
import { runWithRequestId } from "@/lib/request-context";

const reasonSchema = z.nativeEnum(FeedbackReason);
const reviewStatusSchema = z.enum([
  FeedbackStatus.RESOLVED,
  FeedbackStatus.DISMISSED,
]);

const submitSchema = z.object({
  questionId: z.string().min(1),
  reason: reasonSchema,
  comment: z.string().max(2000).optional().nullable(),
});

const updateStatusSchema = z.object({
  feedbackId: z.string().min(1),
  status: reviewStatusSchema,
});

export type FeedbackActionResult = {
  success: boolean;
  message: string;
};

export async function submitQuestionFeedbackAction(input: {
  questionId: string;
  reason: "TYPO" | "WRONG_ANSWER" | "UNCLEAR_REASONING" | "OTHER";
  comment?: string | null;
}): Promise<FeedbackActionResult> {
  return runWithRequestId(async () => {
    const user = await getSessionUser();
    if (!user?.id) {
      return { success: false, message: "برای گزارش اشکال باید وارد شوید" };
    }

    const parsed = submitSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, message: "اطلاعات گزارش معتبر نیست" };
    }

    try {
      await submitQuestionFeedback(user.id, {
        questionId: parsed.data.questionId,
        reason: parsed.data.reason,
        comment: parsed.data.comment,
      });
      return { success: true, message: "گزارش شما ثبت شد. از همکاری‌تان سپاسگزاریم." };
    } catch (error) {
      if (error instanceof Error && error.message === "QUESTION_NOT_FOUND") {
        return { success: false, message: "سوال یافت نشد" };
      }
      return { success: false, message: "خطا در ثبت گزارش" };
    }
  });
}

export async function updateFeedbackStatusAction(input: {
  feedbackId: string;
  status: "RESOLVED" | "DISMISSED";
}): Promise<FeedbackActionResult> {
  return runWithRequestId(async () => {
    const user = await getSessionUser();
    if (!user?.id) {
      return { success: false, message: "برای بررسی گزارش باید وارد شوید" };
    }
    if (user.role !== Role.INSTRUCTOR) {
      return { success: false, message: "فقط استادان می‌توانند گزارش‌ها را بررسی کنند" };
    }

    const parsed = updateStatusSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, message: "وضعیت گزارش معتبر نیست" };
    }

    try {
      await updateFeedbackStatus(parsed.data.feedbackId, parsed.data.status);
      return {
        success: true,
        message:
          parsed.data.status === FeedbackStatus.RESOLVED
            ? "گزارش تایید و رفع شد"
            : "گزارش رد شد",
      };
    } catch (error) {
      if (error instanceof Error && error.message === "FEEDBACK_NOT_FOUND") {
        return { success: false, message: "گزارش یافت نشد" };
      }
      return { success: false, message: "خطا در به‌روزرسانی وضعیت گزارش" };
    }
  });
}

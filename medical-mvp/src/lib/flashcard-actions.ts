"use server";

import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import {
  submitCardReview,
  type FlashcardRating,
} from "@/lib/flashcard-service";
import { checkAndAwardAchievements, type AchievementUnlock } from "@/lib/gamification-service";
import { getLogger } from "@/lib/logger";
import { withServerAction } from "@/lib/server-action";

const ratingSchema = z.enum(["again", "hard", "good", "easy"]);

export type FlashcardActionResult = {
  success: boolean;
  message: string;
  newAchievements?: AchievementUnlock[];
};

function serializeCaughtError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { message: "UnknownError" };
}

export async function submitFlashcardReviewAction(
  flashcardId: string,
  rating: FlashcardRating,
): Promise<FlashcardActionResult> {
  const user = await getSessionUser();
  if (!user?.id) {
    return { success: false, message: "برای ثبت مرور باید وارد شوید" };
  }

  return withServerAction(
    {
      operation: "flashcard-review",
      userId: user.id,
      input: { flashcardId, rating },
    },
    async () => {
      const parsedRating = ratingSchema.safeParse(rating);
      if (!flashcardId || !parsedRating.success) {
        return { success: false, message: "اطلاعات مرور معتبر نیست" };
      }

      try {
        await submitCardReview(user.id, flashcardId, parsedRating.data);
        const newAchievements = await checkAndAwardAchievements(user.id);
        return {
          success: true,
          message: "مرور ثبت شد",
          newAchievements: newAchievements.length > 0 ? newAchievements : undefined,
        };
      } catch (error) {
        getLogger().error(
          {
            event: "flashcard.review.failed",
            userId: user.id,
            flashcardId,
            err: serializeCaughtError(error),
          },
          "Flashcard review failed",
        );
        if (error instanceof Error && error.message === "FLASHCARD_NOT_FOUND") {
          return { success: false, message: "فلش‌کارت یافت نشد" };
        }
        return { success: false, message: "خطا در ثبت مرور فلش‌کارت" };
      }
    },
  );
}

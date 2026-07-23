"use server";

import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import {
  saveUserNote,
  toggleBookmark,
} from "@/lib/bookmark-service";
import { runWithRequestId } from "@/lib/request-context";

const caseIdSchema = z.string().min(1);
const noteContentSchema = z.string();

export type BookmarkActionResult = {
  success: boolean;
  message: string;
  bookmarked?: boolean;
};

export async function toggleBookmarkAction(
  caseId: string,
): Promise<BookmarkActionResult> {
  return runWithRequestId(async () => {
    const user = await getSessionUser();
    if (!user?.id) {
      return { success: false, message: "برای نشانه‌گذاری باید وارد شوید" };
    }

    const parsedCaseId = caseIdSchema.safeParse(caseId);
    if (!parsedCaseId.success) {
      return { success: false, message: "شناسه کیس معتبر نیست" };
    }

    try {
      const result = await toggleBookmark(user.id, parsedCaseId.data);
      return {
        success: true,
        message: result.bookmarked ? "کیس نشانه‌گذاری شد" : "نشانه حذف شد",
        bookmarked: result.bookmarked,
      };
    } catch (error) {
      if (error instanceof Error && error.message === "CASE_NOT_FOUND") {
        return { success: false, message: "کیس یافت نشد" };
      }
      return { success: false, message: "خطا در نشانه‌گذاری کیس" };
    }
  });
}

export async function saveUserNoteAction(
  caseId: string,
  content: string,
): Promise<BookmarkActionResult> {
  return runWithRequestId(async () => {
    const user = await getSessionUser();
    if (!user?.id) {
      return { success: false, message: "برای ذخیره یادداشت باید وارد شوید" };
    }

    const parsedCaseId = caseIdSchema.safeParse(caseId);
    const parsedContent = noteContentSchema.safeParse(content);
    if (!parsedCaseId.success || !parsedContent.success) {
      return { success: false, message: "اطلاعات یادداشت معتبر نیست" };
    }

    try {
      await saveUserNote(user.id, parsedCaseId.data, parsedContent.data);
      const cleared = parsedContent.data.trim().length === 0;
      return {
        success: true,
        message: cleared ? "یادداشت حذف شد" : "یادداشت ذخیره شد",
      };
    } catch (error) {
      if (error instanceof Error && error.message === "CASE_NOT_FOUND") {
        return { success: false, message: "کیس یافت نشد" };
      }
      return { success: false, message: "خطا در ذخیره یادداشت" };
    }
  });
}

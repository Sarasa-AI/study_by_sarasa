"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { getLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { withServerAction } from "@/lib/server-action";

const reviewSchema = z.object({
  caseId: z.string().min(1),
  status: z.enum(["PUBLISHED", "REJECTED"]),
  notes: z.string().max(5000).optional(),
});

export type PeerReviewActionResult = {
  success: boolean;
  message: string;
};

function serializeCaughtError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { message: "UnknownError" };
}

export async function submitCaseReview(
  caseId: string,
  status: "PUBLISHED" | "REJECTED",
  notes?: string,
): Promise<PeerReviewActionResult> {
  const user = await getSessionUser();
  if (!user?.id) {
    return { success: false, message: "برای بررسی کیس باید وارد شوید" };
  }
  if (user.role !== Role.INSTRUCTOR) {
    return { success: false, message: "فقط استادان می‌توانند کیس‌ها را بررسی کنند" };
  }

  const trimmedNotes = notes?.trim() ?? "";
  const hasNotes = trimmedNotes.length > 0;

  return withServerAction(
    {
      operation: "case-peer-review",
      userId: user.id,
      input: { caseId, status, hasNotes },
    },
    async () => {
      const parsed = reviewSchema.safeParse({ caseId, status, notes });
      if (!parsed.success) {
        return { success: false, message: "اطلاعات بررسی معتبر نیست" };
      }

      if (parsed.data.status === "REJECTED" && !hasNotes) {
        return {
          success: false,
          message: "برای رد کیس، نوشتن بازخورد الزامی است",
        };
      }

      try {
        const existing = await prisma.case.findUnique({
          where: { id: parsed.data.caseId },
          select: { id: true },
        });
        if (!existing) {
          return { success: false, message: "کیس یافت نشد" };
        }

        await prisma.case.update({
          where: { id: parsed.data.caseId },
          data: {
            status: parsed.data.status,
            reviewerId: user.id,
            reviewNotes: hasNotes ? trimmedNotes : null,
          },
        });

        revalidatePath("/instructor/reviews");

        return {
          success: true,
          message:
            parsed.data.status === "PUBLISHED"
              ? "کیس تایید و منتشر شد"
              : "کیس با بازخورد رد شد",
        };
      } catch (error) {
        getLogger().error(
          {
            event: "case.peer_review.failed",
            userId: user.id,
            caseId: parsed.data.caseId,
            err: serializeCaughtError(error),
          },
          "Case peer review failed",
        );
        return { success: false, message: "خطا در ثبت نتیجه بررسی" };
      }
    },
  );
}

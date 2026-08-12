"use server";

import { Prisma, Role } from "@prisma/client";
import { revalidateTag } from "next/cache";
import { ZodError } from "zod";
import {
  type CaseActionResult,
  type CaseFormValues,
  type CaseStatusValue,
  formatZodError,
  toCasePayload,
} from "@/lib/case-schema";
import { createCase, getCaseById, serializeCase, updateCase } from "@/lib/case-service";
import { getSessionUser } from "@/lib/auth";
import { getLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { withServerAction } from "@/lib/server-action";
import { serializeError } from "@/lib/serialize-error";

async function resolveInstructorId(): Promise<{ id: string } | { error: string }> {
  const user = await getSessionUser();
  if (!user) {
    return { error: "UNAUTHORIZED" };
  }
  if (user.role !== Role.INSTRUCTOR) {
    return { error: "FORBIDDEN" };
  }
  return { id: user.id };
}


function handleActionError(error: unknown): CaseActionResult {
  if (error instanceof ZodError) {
    return { success: false, message: formatZodError(error) };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2003") {
      return { success: false, message: "دسته‌بندی انتخاب‌شده معتبر نیست" };
    }
    return { success: false, message: "خطا در ذخیره‌سازی داده" };
  }

  return { success: false, message: "خطای سرور" };
}

function authErrorMessage(code: string, action: "create" | "update"): string {
  if (code === "UNAUTHORIZED") {
    return action === "create" ? "برای ایجاد کیس باید وارد شوید" : "برای ویرایش کیس باید وارد شوید";
  }
  return "فقط استادان می‌توانند کیس ایجاد یا ویرایش کنند";
}

export async function createCaseAction(values: CaseFormValues, status: CaseStatusValue): Promise<CaseActionResult> {
  const resolved = await resolveInstructorId();
  if ("error" in resolved) {
    return { success: false, message: authErrorMessage(resolved.error, "create") };
  }

  return withServerAction(
    {
      operation: "case-create",
      userId: resolved.id,
      input: { status, categoryId: values.categoryId, titleLength: values.title?.length ?? 0 },
    },
    async () => {
      try {
        const payload = toCasePayload(values, resolved.id, status);
        const created = await prisma.$transaction((tx) => createCase(tx, payload));
        revalidateTag("cohort-analytics");
        return {
          success: true,
          message: status === "PUBLISHED" ? "کیس با موفقیت منتشر شد" : "پیش‌نویس ذخیره شد",
          data: serializeCase(created),
        };
      } catch (error) {
        getLogger().error(
          {
            event: "case.create.failed",
            userId: resolved.id,
            err: serializeError(error),
          },
          "Case create failed",
        );
        return handleActionError(error);
      }
    },
  );
}

export async function deleteCaseAction(id: string): Promise<CaseActionResult> {
  const resolved = await resolveInstructorId();
  if ("error" in resolved) {
    return { success: false, message: authErrorMessage(resolved.error, "update") };
  }

  return withServerAction(
    {
      operation: "case-delete",
      userId: resolved.id,
      input: { caseId: id },
    },
    async () => {
      try {
        const existing = await getCaseById(prisma, id);
        if (!existing) {
          return { success: false, message: "کیس یافت نشد" };
        }
        if (existing.instructorId !== resolved.id) {
          return { success: false, message: "شما اجازه حذف این کیس را ندارید" };
        }

        await prisma.$transaction(async (tx) => {
          // UserProgress and QuizResult reference Case without onDelete: Cascade,
          // so they must be removed first to avoid a FK constraint violation.
          await tx.userProgress.deleteMany({ where: { caseId: id } });
          await tx.quizResult.deleteMany({ where: { caseId: id } });
          // All remaining relations (Question→Cascade, UserBookmark→Cascade,
          // UserNote→Cascade, Citation→Cascade, Flashcard→SetNull) are handled
          // by the database; deleting the Case here is safe.
          await tx.case.delete({ where: { id } });
        });

        revalidateTag("cohort-analytics");
        return { success: true, message: "کیس با موفقیت حذف شد" };
      } catch (error) {
        getLogger().error(
          {
            event: "case.delete.failed",
            userId: resolved.id,
            caseId: id,
            err: serializeError(error),
          },
          "Case delete failed",
        );
        return handleActionError(error);
      }
    },
  );
}

export async function updateCaseAction(
  id: string,
  values: CaseFormValues,
  status: CaseStatusValue,
): Promise<CaseActionResult> {
  const resolved = await resolveInstructorId();
  if ("error" in resolved) {
    return { success: false, message: authErrorMessage(resolved.error, "update") };
  }

  return withServerAction(
    {
      operation: "case-update",
      userId: resolved.id,
      input: { caseId: id, status, categoryId: values.categoryId },
    },
    async () => {
      try {
        const existing = await getCaseById(prisma, id);
        if (!existing) {
          return { success: false, message: "کیس یافت نشد" };
        }
        if (existing.instructorId !== resolved.id) {
          return { success: false, message: "شما اجازه ویرایش این کیس را ندارید" };
        }

        const payload = toCasePayload(values, resolved.id, status);
        const updated = await prisma.$transaction((tx) => updateCase(tx, id, payload));
        revalidateTag("cohort-analytics");
        return {
          success: true,
          message: status === "PUBLISHED" ? "کیس با موفقیت به‌روزرسانی شد" : "پیش‌نویس به‌روزرسانی شد",
          data: serializeCase(updated),
        };
      } catch (error) {
        getLogger().error(
          {
            event: "case.update.failed",
            userId: resolved.id,
            caseId: id,
            err: serializeError(error),
          },
          "Case update failed",
        );
        return handleActionError(error);
      }
    },
  );
}

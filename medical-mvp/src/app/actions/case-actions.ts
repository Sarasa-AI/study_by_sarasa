"use server";

import { Prisma, Role } from "@prisma/client";
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
import { prisma } from "@/lib/prisma";

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

  try {
    const payload = toCasePayload(values, resolved.id, status);
    const created = await prisma.$transaction((tx) => createCase(tx, payload));
    return {
      success: true,
      message: status === "PUBLISHED" ? "کیس با موفقیت منتشر شد" : "پیش‌نویس ذخیره شد",
      data: serializeCase(created),
    };
  } catch (error) {
    return handleActionError(error);
  }
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
    return {
      success: true,
      message: status === "PUBLISHED" ? "کیس با موفقیت به‌روزرسانی شد" : "پیش‌نویس به‌روزرسانی شد",
      data: serializeCase(updated),
    };
  } catch (error) {
    return handleActionError(error);
  }
}

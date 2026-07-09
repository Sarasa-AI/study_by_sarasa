"use server";

import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { ZodError } from "zod";
import {
  type CaseActionResult,
  type CaseFormValues,
  type CaseStatusValue,
  formatZodError,
  toCasePayload,
} from "@/lib/case-schema";
import { createCase, getCaseById, serializeCase, updateCase } from "@/lib/case-service";
import { prisma } from "@/lib/prisma";

async function resolveInstructorId(): Promise<string | null> {
  const session = await getServerSession();
  return (session?.user as { id?: string } | undefined)?.id ?? null;
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

export async function createCaseAction(values: CaseFormValues, status: CaseStatusValue): Promise<CaseActionResult> {
  const instructorId = await resolveInstructorId();
  if (!instructorId) {
    return { success: false, message: "برای ایجاد کیس باید وارد شوید" };
  }

  try {
    const payload = toCasePayload(values, instructorId, status);
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
  const instructorId = await resolveInstructorId();
  if (!instructorId) {
    return { success: false, message: "برای ویرایش کیس باید وارد شوید" };
  }

  try {
    const existing = await getCaseById(prisma, id);
    if (!existing) {
      return { success: false, message: "کیس یافت نشد" };
    }
    if (existing.instructorId !== instructorId) {
      return { success: false, message: "شما اجازه ویرایش این کیس را ندارید" };
    }

    const payload = toCasePayload(values, instructorId, status);
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

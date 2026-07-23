"use server";

import { Prisma, Role } from "@prisma/client";
import { z, type ZodError } from "zod";
import { generateCaseWithAI } from "@/lib/ai-case-generator";
import {
  buildPatientInfoFromAi,
  mapAiCaseToFormValues,
  type AiCaseGeneration,
} from "@/lib/ai-schemas";
import { mapAiErrorToClientMessage } from "@/lib/ai-errors";
import { isCategoryWeakForUser } from "@/lib/analytics-service";
import {
  type CaseActionResult,
  type CaseFormValues,
  type CaseStatusValue,
  casePayloadSchema,
  formatZodError,
} from "@/lib/case-schema";
import { createCase, serializeCase } from "@/lib/case-service";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runWithRequestId } from "@/lib/request-context";

export type CaseGenerationResult = CaseActionResult & {
  data?: {
    formValues?: CaseFormValues;
    case?: unknown;
    caseId?: string;
  };
};

async function resolveSystemInstructorId(): Promise<string | null> {
  const instructor = await prisma.user.findFirst({
    where: { role: Role.INSTRUCTOR },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  return instructor?.id ?? null;
}

function handleGenerationError(error: unknown): CaseGenerationResult {
  if (error instanceof z.ZodError) {
    return { success: false, message: formatZodError(error as ZodError) };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2003") {
      return { success: false, message: "دسته‌بندی انتخاب‌شده معتبر نیست" };
    }
    return { success: false, message: "خطا در ذخیره‌سازی داده" };
  }

  const aiMessage = mapAiErrorToClientMessage(error);
  if (aiMessage !== "خطای سرور") {
    return { success: false, message: aiMessage };
  }

  if (error instanceof Error && error.message.includes("expected")) {
    return { success: false, message: "تعداد سوالات تولیدشده با درخواست شما مطابقت ندارد؛ دوباره تلاش کنید" };
  }

  return { success: false, message: "خطای سرور" };
}

function toCasePayload(
  data: AiCaseGeneration,
  categoryId: string,
  instructorId: string,
  status: CaseStatusValue,
) {
  return casePayloadSchema.parse({
    title: data.title,
    categoryId,
    instructorId,
    chiefComplaint: data.chiefComplaint,
    patientInfo: buildPatientInfoFromAi(data),
    mediaUrl: null,
    mediaType: null,
    symptoms: data.symptoms,
    diagnosis: data.diagnosis,
    differentialDiagnosis: data.differentialDiagnosis,
    management: data.management,
    teachingPoints: data.teachingPoints,
    status,
    questions: data.questions.map((question) => ({
      questionText: question.questionText,
      optionA: question.optionA,
      optionB: question.optionB,
      optionC: question.optionC,
      optionD: question.optionD,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      clinicalReasoning: question.clinicalReasoning,
      distractorRationales: question.distractorRationales,
    })),
  });
}

export async function generateClinicalCaseAction(
  categoryId: string,
  topic?: string,
  isRemedial = false,
  persist = false,
): Promise<CaseGenerationResult> {
  return runWithRequestId(async () => {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return { success: false, message: "برای تولید کیس باید وارد شوید" };
    }

    if (!isRemedial && sessionUser.role !== Role.INSTRUCTOR) {
      return { success: false, message: "فقط استادان می‌توانند کیس تولید کنند" };
    }

    const trimmedCategoryId = categoryId?.trim();
    if (!trimmedCategoryId) {
      return { success: false, message: "دسته‌بندی الزامی است" };
    }

    const shouldPersist = isRemedial || persist;

    try {
      if (isRemedial) {
        const isWeak = await isCategoryWeakForUser(sessionUser.id, trimmedCategoryId);
        if (!isWeak) {
          return { success: false, message: "این دسته‌بندی در لیست نقاط ضعف شما نیست" };
        }
      }

      const category = await prisma.category.findUnique({
        where: { id: trimmedCategoryId },
        select: { id: true, name: true },
      });
      if (!category) {
        return { success: false, message: "دسته‌بندی یافت نشد" };
      }

      let caseOwnerId: string | null = null;
      if (shouldPersist) {
        caseOwnerId = isRemedial
          ? await resolveSystemInstructorId()
          : sessionUser.id;
        if (!caseOwnerId) {
          return { success: false, message: "حساب استاد سیستمی برای ذخیره کیس یافت نشد" };
        }
      }

      const aiData = await generateCaseWithAI({
        topic: topic?.trim() ?? "",
        categoryName: category.name,
        questionCount: 1,
        isRemedial,
      });

      const formValues = mapAiCaseToFormValues(aiData, category.id);

      if (!shouldPersist) {
        return {
          success: true,
          message: "کیس با موفقیت تولید شد؛ پیش از ذخیره بررسی کنید",
          data: { formValues },
        };
      }

      const status: CaseStatusValue = isRemedial ? "PUBLISHED" : "DRAFT";
      const payload = toCasePayload(aiData, category.id, caseOwnerId!, status);
      const created = await prisma.$transaction((tx) => createCase(tx, payload));

      return {
        success: true,
        message: isRemedial ? "کیس تمرین هدفمند آماده شد" : "کیس به‌صورت پیش‌نویس ذخیره شد",
        data: { case: serializeCase(created), formValues, caseId: created.id },
      };
    } catch (error) {
      return handleGenerationError(error);
    }
  }, { operation: "case-generation" });
}

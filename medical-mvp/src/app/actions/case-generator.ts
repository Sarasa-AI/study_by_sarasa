"use server";

import { Prisma, Role } from "@prisma/client";
import { z, type ZodError } from "zod";
import { generateCaseWithAI, generateCaseWithRAG } from "@/lib/ai-case-generator";
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
import { getLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { withServerAction } from "@/lib/server-action";

function urlOrDoiFromMetadata(metadata: Prisma.JsonValue): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const record = metadata as Record<string, unknown>;
  const value = record.urlOrDoi ?? record.url ?? record.doi;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

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

function serializeCaughtError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { message: "UnknownError" };
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
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return { success: false, message: "برای تولید کیس باید وارد شوید" };
  }

  if (!isRemedial && sessionUser.role !== Role.INSTRUCTOR) {
    return { success: false, message: "فقط استادان می‌توانند کیس تولید کنند" };
  }

  return withServerAction(
    {
      operation: "case-generation",
      userId: sessionUser.id,
      input: {
        categoryId,
        isRemedial,
        persist,
        topicLength: topic?.length ?? 0,
      },
    },
    async () => {
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
        getLogger().error(
          {
            event: "case.generation.failed",
            userId: sessionUser.id,
            err: serializeCaughtError(error),
          },
          "Clinical case generation failed",
        );
        return handleGenerationError(error);
      }
    },
  );
}

/**
 * Instructor-only RAG case generation. Retrieves clinical KB chunks, grounds the
 * model, persists the case (when requested), and creates Citation rows from
 * authoritative retrieved sources — not free-form model text.
 */
export async function generateClinicalCaseWithRAGAction(
  categoryId: string,
  topic: string,
  persist = true,
): Promise<CaseGenerationResult> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return { success: false, message: "برای تولید کیس باید وارد شوید" };
  }

  if (sessionUser.role !== Role.INSTRUCTOR) {
    return { success: false, message: "فقط استادان می‌توانند کیس مبتنی بر RAG تولید کنند" };
  }

  return withServerAction(
    {
      operation: "case.generate.rag",
      userId: sessionUser.id,
      input: {
        categoryId,
        persist,
        topicLength: topic?.length ?? 0,
      },
    },
    async () => {
      const trimmedCategoryId = categoryId?.trim();
      const trimmedTopic = topic?.trim();
      if (!trimmedCategoryId) {
        return { success: false, message: "دسته‌بندی الزامی است" };
      }
      if (!trimmedTopic) {
        return { success: false, message: "موضوع (topic) برای تولید RAG الزامی است" };
      }

      try {
        const category = await prisma.category.findUnique({
          where: { id: trimmedCategoryId },
          select: { id: true, name: true },
        });
        if (!category) {
          return { success: false, message: "دسته‌بندی یافت نشد" };
        }

        const ragResult = await generateCaseWithRAG({
          topic: trimmedTopic,
          categoryName: category.name,
          questionCount: 1,
        });

        const formValues = mapAiCaseToFormValues(ragResult.case, category.id);

        if (!persist) {
          return {
            success: true,
            message: "کیس RAG با موفقیت تولید شد؛ پیش از ذخیره بررسی کنید",
            data: { formValues },
          };
        }

        const payload = toCasePayload(ragResult.case, category.id, sessionUser.id, "DRAFT");

        const created = await prisma.$transaction(async (tx) => {
          const kase = await createCase(tx, payload);

          const citationsBySource = new Map<string, string | null>();
          for (const source of ragResult.citationSources) {
            if (!citationsBySource.has(source)) {
              citationsBySource.set(source, null);
            }
          }
          for (const doc of ragResult.retrievedDocuments) {
            if (!citationsBySource.has(doc.source)) continue;
            if (citationsBySource.get(doc.source)) continue;
            citationsBySource.set(doc.source, urlOrDoiFromMetadata(doc.metadata));
          }

          if (citationsBySource.size > 0) {
            await tx.citation.createMany({
              data: [...citationsBySource.entries()].map(([text, urlOrDoi]) => ({
                text,
                urlOrDoi,
                caseId: kase.id,
              })),
            });
          }

          return kase;
        });

        return {
          success: true,
          message: "کیس RAG با استناد ذخیره شد",
          data: { case: serializeCase(created), formValues, caseId: created.id },
        };
      } catch (error) {
        getLogger().error(
          {
            event: "case.generation.rag.failed",
            userId: sessionUser.id,
            err: serializeCaughtError(error),
          },
          "RAG clinical case generation failed",
        );
        return handleGenerationError(error);
      }
    },
  );
}

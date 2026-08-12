"use server";

import { Prisma, Role } from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";
import { z, ZodError } from "zod";
import { generateCaseWithRAG, type CaseDifficulty } from "@/lib/ai-case-generator";
import { FALLBACK_REFERENCE_NOTE, mapAiCaseToFormValues } from "@/lib/ai-schemas";
import { mapAiErrorToClientMessage } from "@/lib/ai-errors";
import {
  answerOptions,
  caseStatusValues,
  type CaseActionResult,
  type CaseFormValues,
  type CaseStatusValue,
  formatZodError,
  toCasePayload,
} from "@/lib/case-schema";
import { getSessionUser, requireInstructorApi } from "@/lib/auth";
import { embedAndStoreCase } from "@/lib/case-embedding";
import { deleteCaseById, getCaseById, serializeCase, updateCase } from "@/lib/case-service";
import { getLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { parseDistractorRationales } from "@/lib/quiz";
import { withServerAction } from "@/lib/server-action";
import { serializeError } from "@/lib/serialize-error";

export type GenerateAICaseActionInput = {
  topic: string;
  categoryId: string;
  difficulty?: CaseDifficulty;
  questionCount?: number;
};

export type GenerateAICaseActionResult = CaseActionResult & {
  data?: {
    formValues?: CaseFormValues;
    isFallback?: boolean;
  };
};


function handleGenerationError(error: unknown): GenerateAICaseActionResult {
  if (error instanceof z.ZodError) {
    return { success: false, message: formatZodError(error as ZodError) };
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

export async function generateAICaseAction(
  input: GenerateAICaseActionInput,
): Promise<GenerateAICaseActionResult> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return { success: false, message: "برای تولید کیس باید وارد شوید" };
  }

  if (sessionUser.role !== Role.INSTRUCTOR) {
    return { success: false, message: "فقط استادان می‌توانند کیس تولید کنند" };
  }

  return withServerAction(
    {
      operation: "case-generation",
      userId: sessionUser.id,
      input: {
        categoryId: input.categoryId,
        difficulty: input.difficulty,
        questionCount: input.questionCount,
        topicLength: input.topic?.length ?? 0,
      },
    },
    async () => {
      const topic = input.topic?.trim() ?? "";
      if (!topic) {
        return { success: false, message: "موضوع یا سناریوی بالینی الزامی است" };
      }

      const categoryId = input.categoryId?.trim() ?? "";
      if (!categoryId) {
        return { success: false, message: "دسته‌بندی الزامی است" };
      }

      try {
        const category = await prisma.category.findUnique({
          where: { id: categoryId },
          select: { id: true, name: true },
        });
        if (!category) {
          return { success: false, message: "دسته‌بندی یافت نشد" };
        }

        const rag = await generateCaseWithRAG({
          topic,
          categoryName: category.name,
          difficulty: input.difficulty,
          questionCount: input.questionCount,
        });

        const formValues: CaseFormValues = {
          ...mapAiCaseToFormValues(rag.case, category.id),
          referencesText: rag.isFallback
            ? FALLBACK_REFERENCE_NOTE
            : rag.citationSources.join("\n"),
        };

        return {
          success: true,
          message: rag.isFallback
            ? "کیس تولید شد، اما بر پایه دانش عمومی مدل و بدون رفرنس اختصاصی است"
            : "کیس با موفقیت تولید شد؛ پیش از ذخیره بررسی کنید",
          data: { formValues, isFallback: rag.isFallback },
        };
      } catch (error) {
        getLogger().error(
          {
            event: "case.generation.failed",
            userId: sessionUser.id,
            err: serializeError(error),
          },
          "AI case generation failed",
        );
        return handleGenerationError(error);
      }
    },
  );
}

export type CaseStatusFilter = CaseStatusValue | "ALL";

export type ManagedCaseSummary = {
  id: string;
  title: string;
  categoryName: string;
  questionCount: number;
  status: CaseStatusValue;
  updatedAt: string;
};

export type CaseStatusCounts = Record<CaseStatusValue, number> & { all: number };

export type PendingCaseSummary = {
  id: string;
  title: string;
  categoryName: string;
  questionCount: number;
  status: "DRAFT" | "IN_REVIEW";
  updatedAt: string;
};

export type CaseForEdit = {
  id: string;
  title: string;
  categoryId: string;
  chiefComplaint: string;
  patientInfo: string;
  mediaUrl: string | null;
  mediaType: "IMAGE" | "VIDEO" | "AUDIO" | null;
  references: string | null;
  symptoms: string[];
  diagnosis: string;
  differentialDiagnosis: string[];
  management: string;
  teachingPoints: string[];
  questions: Array<{
    id: string;
    questionText: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctAnswer: "A" | "B" | "C" | "D";
    explanation: string;
    clinicalReasoning: string | null;
    distractorRationales: Partial<Record<"A" | "B" | "C" | "D", string>> | null;
  }>;
};

function handleReviewActionError(error: unknown): CaseActionResult {
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

/** Pending review queue: DRAFT / IN_REVIEW only (excludes PUBLISHED and REJECTED). */
export async function getPendingCases(): Promise<PendingCaseSummary[]> {
  const user = await requireInstructorApi();
  if (!user) {
    return [];
  }

  return withServerAction(
    { operation: "instructor.getPendingCases", userId: user.id },
    async () => {
      const cases = await prisma.case.findMany({
        where: { status: { in: ["DRAFT", "IN_REVIEW"] } },
        include: {
          category: { select: { name: true } },
          _count: { select: { questions: true } },
        },
        orderBy: { updatedAt: "desc" },
      });

      return cases.map((kase) => ({
        id: kase.id,
        title: kase.title,
        categoryName: kase.category.name,
        questionCount: kase._count.questions,
        status: kase.status as "DRAFT" | "IN_REVIEW",
        updatedAt: kase.updatedAt.toISOString(),
      }));
    },
  );
}

/** Case management list filtered by DRAFT / PUBLISHED / REJECTED (or ALL). */
export async function getManagedCases(
  filter: CaseStatusFilter = "ALL",
): Promise<ManagedCaseSummary[]> {
  const user = await requireInstructorApi();
  if (!user) {
    return [];
  }

  return withServerAction(
    { operation: "instructor.getManagedCases", userId: user.id, input: { filter } },
    async () => {
      const cases = await prisma.case.findMany({
        where:
          filter === "ALL"
            ? { status: { in: [...caseStatusValues] } }
            : { status: filter },
        include: {
          category: { select: { name: true } },
          _count: { select: { questions: true } },
        },
        orderBy: { updatedAt: "desc" },
      });

      return cases.map((kase) => ({
        id: kase.id,
        title: kase.title,
        categoryName: kase.category.name,
        questionCount: kase._count.questions,
        status: kase.status as CaseStatusValue,
        updatedAt: kase.updatedAt.toISOString(),
      }));
    },
  );
}

/** Counts of cases in each managed status bucket. */
export async function getCaseStatusCounts(): Promise<CaseStatusCounts> {
  const user = await requireInstructorApi();
  if (!user) {
    return { DRAFT: 0, PUBLISHED: 0, REJECTED: 0, all: 0 };
  }

  return withServerAction(
    { operation: "instructor.getCaseStatusCounts", userId: user.id },
    async () => {
      const groups = await prisma.case.groupBy({
        by: ["status"],
        where: { status: { in: [...caseStatusValues] } },
        _count: { _all: true },
      });

      const counts: CaseStatusCounts = { DRAFT: 0, PUBLISHED: 0, REJECTED: 0, all: 0 };
      for (const group of groups) {
        if ((caseStatusValues as readonly string[]).includes(group.status)) {
          const status = group.status as CaseStatusValue;
          counts[status] = group._count._all;
          counts.all += group._count._all;
        }
      }
      return counts;
    },
  );
}

/** Quick status change (publish / reject / restore draft) without a full form payload. */
export async function setCaseStatusAction(
  caseId: string,
  status: CaseStatusValue,
): Promise<CaseActionResult> {
  const user = await requireInstructorApi();
  if (!user) {
    return { success: false, message: "فقط استادان می‌توانند کیس را بررسی و منتشر کنند" };
  }

  return withServerAction(
    {
      operation: "instructor.setCaseStatus",
      userId: user.id,
      input: { caseId, status },
    },
    async () => {
      try {
        const existing = await prisma.case.findUnique({
          where: { id: caseId },
          select: {
            id: true,
            status: true,
            title: true,
            chiefComplaint: true,
            patientInfo: true,
            symptoms: true,
            diagnosis: true,
            differentialDiagnosis: true,
            management: true,
            teachingPoints: true,
          },
        });
        if (!existing) {
          return { success: false, message: "کیس یافت نشد" };
        }

        const previousStatus = existing.status;

        await prisma.case.update({
          where: { id: caseId },
          data: {
            status,
            ...(status === "PUBLISHED" || status === "REJECTED"
              ? { reviewerId: user.id }
              : {}),
          },
        });

        if (status === "REJECTED") {
          await prisma.$executeRaw`UPDATE "Case" SET embedding = NULL WHERE id = ${caseId}`;
        } else if (previousStatus === "REJECTED") {
          await embedAndStoreCase(prisma, caseId, {
            title: existing.title,
            chiefComplaint: existing.chiefComplaint,
            patientInfo: existing.patientInfo,
            symptoms: existing.symptoms,
            diagnosis: existing.diagnosis,
            differentialDiagnosis: existing.differentialDiagnosis,
            management: existing.management,
            teachingPoints: existing.teachingPoints,
          });
        }

        revalidatePath("/instructor/reviews");
        revalidatePath(`/instructor/cases/${caseId}/edit`);
        revalidateTag("cohort-analytics");

        const message =
          status === "PUBLISHED"
            ? "کیس با موفقیت منتشر شد و برای دانشجویان در دسترس است"
            : status === "REJECTED"
              ? "کیس با موفقیت رد و بایگانی شد"
              : "پیش‌نویس با موفقیت ذخیره شد";

        return { success: true, message };
      } catch (error) {
        getLogger().error(
          {
            event: "instructor.case.set_status.failed",
            userId: user.id,
            caseId,
            status,
            err: serializeError(error),
          },
          "Instructor case status update failed",
        );
        return handleReviewActionError(error);
      }
    },
  );
}

/** Delete a case from the management panel. */
export async function deleteCaseAction(caseId: string): Promise<CaseActionResult> {
  const user = await requireInstructorApi();
  if (!user) {
    return { success: false, message: "فقط استادان می‌توانند کیس را حذف کنند" };
  }

  return withServerAction(
    {
      operation: "instructor.deleteCase",
      userId: user.id,
      input: { caseId },
    },
    async () => {
      try {
        const existing = await prisma.case.findUnique({
          where: { id: caseId },
          select: { id: true },
        });
        if (!existing) {
          return { success: false, message: "کیس یافت نشد" };
        }

        await deleteCaseById(prisma, caseId);
        revalidatePath("/instructor/reviews");
        revalidateTag("cohort-analytics");

        return { success: true, message: "کیس با موفقیت حذف شد" };
      } catch (error) {
        getLogger().error(
          {
            event: "instructor.case.delete.failed",
            userId: user.id,
            caseId,
            err: serializeError(error),
          },
          "Instructor case delete failed",
        );
        return handleReviewActionError(error);
      }
    },
  );
}

export async function getCaseForEdit(id: string): Promise<CaseForEdit | null> {
  const user = await requireInstructorApi();
  if (!user) {
    return null;
  }

  return withServerAction(
    { operation: "instructor.getCaseForEdit", userId: user.id, input: { caseId: id } },
    async () => {
      const kase = await getCaseById(prisma, id);
      const serialized = serializeCase(kase);
      if (!serialized) {
        return null;
      }

      const citationFallback =
        !serialized.references && Array.isArray(serialized.citations)
          ? serialized.citations
              .map((citation: { text?: string }) => citation.text?.trim())
              .filter(Boolean)
              .join("\n") || null
          : null;

      return {
        id: serialized.id,
        title: serialized.title,
        categoryId: serialized.categoryId,
        chiefComplaint: serialized.chiefComplaint,
        patientInfo: serialized.patientInfo,
        mediaUrl: serialized.mediaUrl,
        mediaType: serialized.mediaType,
        references: serialized.references ?? citationFallback,
        symptoms: serialized.symptoms,
        diagnosis: serialized.diagnosis,
        differentialDiagnosis: serialized.differentialDiagnosis,
        management: serialized.management,
        teachingPoints: serialized.teachingPoints,
        questions: serialized.questions.map(
          (question: {
            id: string;
            questionText: string;
            optionA: string;
            optionB: string;
            optionC: string;
            optionD: string;
            correctAnswer: string;
            explanation: string;
            clinicalReasoning?: string | null;
            distractorRationales?: unknown;
          }) => ({
            id: question.id,
            questionText: question.questionText,
            optionA: question.optionA,
            optionB: question.optionB,
            optionC: question.optionC,
            optionD: question.optionD,
            correctAnswer: (answerOptions.includes(
              question.correctAnswer as (typeof answerOptions)[number],
            )
              ? question.correctAnswer
              : "A") as "A" | "B" | "C" | "D",
            explanation: question.explanation,
            clinicalReasoning: question.clinicalReasoning ?? null,
            distractorRationales: parseDistractorRationales(question.distractorRationales),
          }),
        ),
      };
    },
  );
}

export async function updateAndPublishCase(
  caseId: string,
  values: CaseFormValues,
  status: CaseStatusValue,
): Promise<CaseActionResult> {
  const user = await requireInstructorApi();
  if (!user) {
    return { success: false, message: "فقط استادان می‌توانند کیس را بررسی و منتشر کنند" };
  }

  return withServerAction(
    {
      operation: "instructor.updateAndPublishCase",
      userId: user.id,
      input: { caseId, status, categoryId: values.categoryId },
    },
    async () => {
      try {
        const existing = await prisma.case.findUnique({
          where: { id: caseId },
          select: { id: true, instructorId: true },
        });
        if (!existing) {
          return { success: false, message: "کیس یافت نشد" };
        }

        const payload = toCasePayload(values, existing.instructorId, status);

        const updated = await prisma.$transaction(async (tx) => {
          const result = await updateCase(tx, caseId, payload);
          if (status === "PUBLISHED" || status === "REJECTED") {
            await tx.case.update({
              where: { id: caseId },
              data: { reviewerId: user.id },
            });
          }
          return result;
        });

        revalidatePath("/instructor/reviews");
        revalidatePath(`/instructor/cases/${caseId}/edit`);
        revalidateTag("cohort-analytics");

        const message =
          status === "PUBLISHED"
            ? "کیس با موفقیت منتشر شد و برای دانشجویان در دسترس است"
            : status === "REJECTED"
              ? "کیس با موفقیت رد و بایگانی شد"
              : "پیش‌نویس با موفقیت ذخیره شد";

        return {
          success: true,
          message,
          data: serializeCase(updated),
        };
      } catch (error) {
        getLogger().error(
          {
            event: "instructor.case.update_publish.failed",
            userId: user.id,
            caseId,
            err: serializeError(error),
          },
          "Instructor case update/publish failed",
        );
        return handleReviewActionError(error);
      }
    },
  );
}

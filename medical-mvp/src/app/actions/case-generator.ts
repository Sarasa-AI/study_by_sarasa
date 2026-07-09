"use server";

import { Prisma, Role } from "@prisma/client";
import { getServerSession } from "next-auth";
import { z, type ZodError } from "zod";
import {
  aiCaseGenerationSchema,
  buildPatientInfoFromAi,
  mapAiCaseToFormValues,
  normalizeAiCaseGeneration,
  type AiCaseGeneration,
} from "@/lib/ai-schemas";
import { AIGatewayError, AIValidationError, generateStructuredData } from "@/lib/ai";
import { isCategoryWeakForUser } from "@/lib/analytics-service";
import {
  type CaseActionResult,
  type CaseFormValues,
  type CaseStatusValue,
  casePayloadSchema,
  formatZodError,
} from "@/lib/case-schema";
import { createCase, serializeCase } from "@/lib/case-service";
import { prisma } from "@/lib/prisma";

export type CaseGenerationResult = CaseActionResult & {
  data?: {
    formValues?: CaseFormValues;
    case?: unknown;
    caseId?: string;
  };
};

type SessionUser = {
  id: string;
  role: Role;
};

async function resolveSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession();
  const user = session?.user as { id?: string; role?: Role } | undefined;
  if (!user?.id) return null;
  return { id: user.id, role: user.role ?? Role.STUDENT };
}

async function resolveSystemInstructorId(): Promise<string | null> {
  const instructor = await prisma.user.findFirst({
    where: { role: Role.INSTRUCTOR },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  return instructor?.id ?? null;
}

function handleGenerationError(error: unknown): CaseGenerationResult {
  if (error instanceof AIValidationError) {
    return { success: false, message: "خروجی هوش مصنوعی با ساختار مورد انتظار مطابقت ندارد" };
  }
  if (error instanceof AIGatewayError) {
    const messages: Record<string, string> = {
      RATE_LIMIT: "محدودیت درخواست هوش مصنوعی؛ لطفاً کمی بعد تلاش کنید",
      NETWORK_ERROR: "خطا در اتصال به سرویس هوش مصنوعی",
      PARSE_ERROR: "پاسخ هوش مصنوعی قابل پردازش نبود",
      API_ERROR: "خطا در سرویس هوش مصنوعی",
    };
    return { success: false, message: messages[error.code] ?? "خطای هوش مصنوعی" };
  }
  if (error instanceof z.ZodError) {
    return { success: false, message: formatZodError(error as ZodError) };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2003") {
      return { success: false, message: "دسته‌بندی انتخاب‌شده معتبر نیست" };
    }
    return { success: false, message: "خطا در ذخیره‌سازی داده" };
  }
  return { success: false, message: "خطای سرور" };
}

function buildClinicalPrompt(categoryName: string, topic?: string, isRemedial = false): string {
  const focus = topic?.trim()
    ? `Focus the case on: "${topic.trim()}".`
    : `Choose a high-yield pediatric topic appropriate for the "${categoryName}" category.`;

  const lines = [
    "Generate one complete pediatric clinical teaching case.",
    focus,
    "Use evidence-based content aligned with Nelson Textbook of Pediatrics and UpToDate pediatric guidelines.",
    "Write clinical content in Persian (Farsi). Use standard medical abbreviations where appropriate.",
    "Include realistic age-appropriate presentation, vitals, exam findings, labs, and imaging when relevant.",
    "The MCQ must test clinical reasoning (diagnosis or management), not trivia.",
    "Return JSON matching the required schema exactly.",
  ];

  if (isRemedial) {
    lines.splice(
      2,
      0,
      `This is a Targeted Practice session for the "${categoryName}" category — emphasize core concepts and common pitfalls.`,
    );
  }

  return lines.join("\n");
}

const SYSTEM_INSTRUCTION = [
  "You are a senior Pediatrics attending physician authoring board-style teaching cases.",
  "Output must be clinically accurate, age-appropriate, and educationally focused.",
  "Use management and teachingPoints fields (not deprecated alternatives).",
  "Use optionA–optionD and correctOption (A|B|C|D) for the question.",
].join(" ");

const REMEDIAL_INSTRUCTION = [
  "This student is struggling with this category.",
  "Focus the case on the core concepts, common diagnostic pitfalls, and pathophysiology related to this topic to help them improve their understanding.",
  "Treat this as a Targeted Practice session.",
].join(" ");

function buildSystemInstruction(isRemedial: boolean): string {
  if (!isRemedial) return SYSTEM_INSTRUCTION;
  return [SYSTEM_INSTRUCTION, REMEDIAL_INSTRUCTION].join(" ");
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
    questions: [
      {
        questionText: data.question.questionText,
        optionA: data.question.optionA,
        optionB: data.question.optionB,
        optionC: data.question.optionC,
        optionD: data.question.optionD,
        correctAnswer: data.question.correctOption,
        explanation: data.question.explanation,
      },
    ],
  });
}

export async function generateClinicalCaseAction(
  categoryId: string,
  topic?: string,
  isRemedial = false,
  persist = false,
): Promise<CaseGenerationResult> {
  const sessionUser = await resolveSessionUser();
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

    const aiData = normalizeAiCaseGeneration(
      (await generateStructuredData({
        schema: aiCaseGenerationSchema,
        systemInstruction: buildSystemInstruction(isRemedial),
        prompt: buildClinicalPrompt(category.name, topic, isRemedial),
      })) as z.infer<typeof aiCaseGenerationSchema>,
    );

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
}

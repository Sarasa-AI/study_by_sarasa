"use server";

import { Role } from "@prisma/client";
import { z, type ZodError } from "zod";
import { generateCaseWithAI, type CaseDifficulty } from "@/lib/ai-case-generator";
import { mapAiCaseToFormValues } from "@/lib/ai-schemas";
import { mapAiErrorToClientMessage } from "@/lib/ai-errors";
import {
  type CaseActionResult,
  type CaseFormValues,
  formatZodError,
} from "@/lib/case-schema";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runWithRequestId } from "@/lib/request-context";

export type GenerateAICaseActionInput = {
  topic: string;
  categoryId: string;
  difficulty?: CaseDifficulty;
  questionCount?: number;
};

export type GenerateAICaseActionResult = CaseActionResult & {
  data?: {
    formValues?: CaseFormValues;
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
  return runWithRequestId(async () => {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return { success: false, message: "برای تولید کیس باید وارد شوید" };
    }

    if (sessionUser.role !== Role.INSTRUCTOR) {
      return { success: false, message: "فقط استادان می‌توانند کیس تولید کنند" };
    }

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

      const aiData = await generateCaseWithAI({
        topic,
        categoryName: category.name,
        difficulty: input.difficulty,
        questionCount: input.questionCount,
        isRemedial: false,
      });

      return {
        success: true,
        message: "کیس با موفقیت تولید شد؛ پیش از ذخیره بررسی کنید",
        data: { formValues: mapAiCaseToFormValues(aiData, category.id) },
      };
    } catch (error) {
      return handleGenerationError(error);
    }
  }, { operation: "case-generation" });
}

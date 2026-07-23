"use server";

import { getStudentPerformanceStats } from "@/lib/analytics-service";
import { mapAiErrorToClientMessage } from "@/lib/ai-errors";
import { getSessionUser } from "@/lib/auth";
import { getCaseById } from "@/lib/case-service";
import { generateMentorReply } from "@/lib/mentor-service";
import type { MentorChatMessage, MentorChatResult, MentorQuizContext } from "@/lib/mentor-types";
import { prisma } from "@/lib/prisma";
import { runWithRequestId } from "@/lib/request-context";

async function resolveUserId(): Promise<string | null> {
  const user = await getSessionUser();
  return user?.id ?? null;
}

function handleMentorError(error: unknown): MentorChatResult {
  const aiMessage = mapAiErrorToClientMessage(error);
  if (aiMessage !== "خطای سرور") {
    return { success: false, message: aiMessage };
  }

  return { success: false, message: "خطای سرور" };
}

export async function mentorChatAction(
  caseId: string,
  history: MentorChatMessage[],
  quizContext?: MentorQuizContext,
): Promise<MentorChatResult> {
  return runWithRequestId(async () => {
    const userId = await resolveUserId();
    if (!userId) {
      return { success: false, message: "برای استفاده از مربی بالینی باید وارد شوید" };
    }

    if (!history.length || history[history.length - 1]?.role !== "user") {
      return { success: false, message: "پیام کاربر یافت نشد" };
    }

    try {
      const kase = await getCaseById(prisma, caseId);
      if (!kase) {
        return { success: false, message: "کیس یافت نشد" };
      }

      const stats = await getStudentPerformanceStats(userId);
      const weakAreas = stats.weakAreas.map((area) => area.name);

      const aiData = await generateMentorReply({
        kase,
        history,
        quizContext,
        weakAreas,
      });

      return {
        success: true,
        message: "پاسخ دریافت شد",
        data: {
          reply: aiData.reply,
          clinicalReasoning: aiData.clinicalReasoning,
        },
      };
    } catch (error) {
      return handleMentorError(error);
    }
  }, { operation: "mentor-reply" });
}

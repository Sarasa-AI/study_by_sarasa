"use server";

import { getServerSession } from "next-auth";
import { mentorReplySchema } from "@/lib/ai-schemas";
import { AIGatewayError, AIValidationError, generateStructuredData } from "@/lib/ai";
import { getCaseById } from "@/lib/case-service";
import type { MentorChatMessage, MentorChatResult, MentorQuizContext } from "@/lib/mentor-types";
import { prisma } from "@/lib/prisma";

const MENTOR_SYSTEM_INSTRUCTION = [
  "You are a supportive, Socratic Pediatrics Attending mentoring medical students.",
  "Never provide direct treatment advice for real patients — this is an educational simulation only.",
  "Focus on clinical reasoning, pathophysiology, and explaining the logic behind correct and incorrect MCQ options.",
  "Always link your answers back to specific case data (history, labs, exam findings, symptoms).",
  "Use Socratic questioning — guide the student to discover answers rather than lecturing.",
  "Respond in Persian (Farsi).",
].join(" ");

async function resolveUserId(): Promise<string | null> {
  const session = await getServerSession();
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

function handleMentorError(error: unknown): MentorChatResult {
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
  return { success: false, message: "خطای سرور" };
}

type MentorCase = NonNullable<Awaited<ReturnType<typeof getCaseById>>>;

type MentorQuestion = {
  id: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  explanation: string | null;
};

function buildQuizContextSection(quizContext: MentorQuizContext | undefined, kase: MentorCase): string {
  if (!quizContext) return "Student quiz answers: not yet provided.";

  const questions = kase.questions as MentorQuestion[];
  const questionMap = Object.fromEntries(questions.map((q) => [q.id, q]));

  if (quizContext.result) {
    const lines = quizContext.result.feedback.map((item, index) => {
      const question = questionMap[item.questionId];
      const questionLabel = question?.questionText ?? item.questionId;
      return [
        `Question ${index + 1}: ${questionLabel}`,
        `  Selected: ${item.selected ?? "none"}`,
        `  Correct: ${item.isCorrect ? "yes" : "no"}`,
      ].join("\n");
    });
    return ["Student submitted quiz results:", ...lines].join("\n");
  }

  const answerLines = Object.entries(quizContext.answers)
    .filter(([, answer]) => answer)
    .map(([questionId, answer]) => {
      const question = questionMap[questionId];
      const questionLabel = question?.questionText ?? questionId;
      return `  - ${questionLabel}: ${answer}`;
    });

  if (answerLines.length === 0) {
    return "Student quiz answers: in progress, no selections yet.";
  }

  return ["Student in-progress quiz answers:", ...answerLines].join("\n");
}

function buildMentorPrompt(
  kase: MentorCase,
  history: MentorChatMessage[],
  quizContext?: MentorQuizContext,
): string {
  const patient = JSON.parse(kase.patientInfo || "{}") as Record<string, unknown>;

  const caseSection = [
    "## Case Context",
    `Title: ${kase.title}`,
    `Chief complaint: ${kase.chiefComplaint}`,
    `Patient demographics: age=${patient.age ?? "unknown"}, gender=${patient.gender ?? "unknown"}`,
    `History: ${patient.history ?? "not provided"}`,
    `Physical exam: ${patient.physicalExam ?? "not provided"}`,
    `Lab results: ${patient.labResults ?? "not provided"}`,
    `Imaging: ${patient.imaging ?? "not provided"}`,
    `Symptoms: ${kase.symptoms.join("; ")}`,
    `Diagnosis: ${kase.diagnosis}`,
    `Differential diagnosis: ${kase.differentialDiagnosis.join("; ")}`,
    `Management: ${kase.management}`,
    `Teaching points: ${kase.teachingPoints.join("; ")}`,
  ].join("\n");

  const questionsSection = [
    "## Quiz Questions (with correct answers — for mentoring only, do not reveal directly unless pedagogically appropriate)",
    ...(kase.questions as MentorQuestion[]).map((q, index) =>
      [
        `Question ${index + 1}: ${q.questionText}`,
        `  A: ${q.optionA}`,
        `  B: ${q.optionB}`,
        `  C: ${q.optionC}`,
        `  D: ${q.optionD}`,
        `  Correct answer: ${q.correctAnswer}`,
        `  Explanation: ${q.explanation ?? "none"}`,
      ].join("\n"),
    ),
  ].join("\n\n");

  const quizSection = buildQuizContextSection(quizContext, kase);

  const historySection =
    history.length > 0
      ? [
          "## Conversation History",
          ...history.map((msg) => `${msg.role === "user" ? "Student" : "Mentor"}: ${msg.content}`),
        ].join("\n")
      : "## Conversation History\n(no prior messages)";

  return [
    caseSection,
    questionsSection,
    `## Student Quiz State\n${quizSection}`,
    historySection,
    "## Instruction",
    "Respond to the student's latest message as the Clinical Mentor.",
    'Return JSON with "reply" (your mentor response in Persian) and optional "clinicalReasoning" (array of key reasoning points in Persian).',
  ].join("\n\n");
}

export async function mentorChatAction(
  caseId: string,
  history: MentorChatMessage[],
  quizContext?: MentorQuizContext,
): Promise<MentorChatResult> {
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

    const aiData = await generateStructuredData({
      schema: mentorReplySchema,
      systemInstruction: MENTOR_SYSTEM_INSTRUCTION,
      prompt: buildMentorPrompt(kase, history, quizContext),
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
}

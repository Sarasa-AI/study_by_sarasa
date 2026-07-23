import type { FeedbackReason, FeedbackStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type SubmitFeedbackInput = {
  questionId: string;
  reason: FeedbackReason;
  comment?: string | null;
};

export type InstructorFeedbackFilter = "PENDING" | "REVIEWED";

export type InstructorFeedbackItem = {
  id: string;
  reason: FeedbackReason;
  comment: string | null;
  status: FeedbackStatus;
  createdAt: Date;
  questionId: string;
  questionText: string;
  caseId: string;
  caseTitle: string;
  reporterName: string;
};

export async function submitQuestionFeedback(
  userId: string,
  input: SubmitFeedbackInput,
) {
  const question = await prisma.question.findUnique({
    where: { id: input.questionId },
    select: { id: true },
  });

  if (!question) {
    throw new Error("QUESTION_NOT_FOUND");
  }

  const comment = input.comment?.trim() || null;

  return prisma.questionFeedback.create({
    data: {
      userId,
      questionId: input.questionId,
      reason: input.reason,
      comment,
      status: "PENDING",
    },
  });
}

export async function getInstructorFeedbacks(
  statusFilter: InstructorFeedbackFilter = "PENDING",
): Promise<InstructorFeedbackItem[]> {
  const statusWhere =
    statusFilter === "PENDING"
      ? { status: "PENDING" as const }
      : { status: { in: ["RESOLVED", "DISMISSED"] as FeedbackStatus[] } };

  const rows = await prisma.questionFeedback.findMany({
    where: statusWhere,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true } },
      question: {
        select: {
          id: true,
          questionText: true,
          case: { select: { id: true, title: true } },
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    reason: row.reason,
    comment: row.comment,
    status: row.status,
    createdAt: row.createdAt,
    questionId: row.question.id,
    questionText: row.question.questionText,
    caseId: row.question.case.id,
    caseTitle: row.question.case.title,
    reporterName: row.user.name,
  }));
}

export async function updateFeedbackStatus(
  feedbackId: string,
  status: Extract<FeedbackStatus, "RESOLVED" | "DISMISSED">,
) {
  const existing = await prisma.questionFeedback.findUnique({
    where: { id: feedbackId },
    select: { id: true },
  });

  if (!existing) {
    throw new Error("FEEDBACK_NOT_FOUND");
  }

  return prisma.questionFeedback.update({
    where: { id: feedbackId },
    data: { status },
  });
}

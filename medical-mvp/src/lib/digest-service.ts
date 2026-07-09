import { weeklyDigestSchema } from "@/lib/ai-schemas";
import { generateStructuredData } from "@/lib/ai";
import { getWeeklyPerformanceContext, type StudentPerformanceStats } from "@/lib/analytics-service";
import {
  buildDigestPrompt,
  buildDigestPromptStats,
  extractStudentFirstName,
} from "@/lib/digest-helpers";
import { renderWeeklyDigestHtml } from "@/emails/WeeklyDigestTemplate";
import { prisma } from "@/lib/prisma";

const DIGEST_SYSTEM_INSTRUCTION = [
  "You are a Senior Medical Educator specializing in pediatrics.",
  "Write a short, encouraging weekly progress summary for a medical student.",
  "Use a professional, supportive, and clinical tone in Persian (Farsi) at C1 level.",
  "Cover: overall performance trend, the most improved category (if any), weak areas needing focus, and streak status.",
  "Never mention student codes, email addresses, patient identifiers, or any personally identifiable information.",
  "Refer only to aggregate learning metrics and category names.",
  "Keep the summary concise: 2 to 4 short paragraphs.",
].join(" ");

export type WeeklyDigest = {
  subject: string;
  summaryHtml: string;
  recipientEmail: string;
  studentFirstName: string;
};

function hasRecentActivity(thisWeek: StudentPerformanceStats, priorWeek: StudentPerformanceStats): boolean {
  return thisWeek.totalAttempts > 0 || priorWeek.totalAttempts > 0;
}

export async function generateWeeklyDigest(userId: string): Promise<WeeklyDigest | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      currentStreak: true,
      longestStreak: true,
      lastQuizCompletedAt: true,
    },
  });

  if (!user?.email) {
    return null;
  }

  const weeklyContext = await getWeeklyPerformanceContext(userId);

  if (!hasRecentActivity(weeklyContext.thisWeek, weeklyContext.priorWeek)) {
    return null;
  }

  const streak = {
    currentStreak: user.currentStreak,
    longestStreak: user.longestStreak,
    lastQuizCompletedAt: user.lastQuizCompletedAt,
  };

  const stats = buildDigestPromptStats(weeklyContext, streak);
  const aiContent = await generateStructuredData({
    operation: "weekly-digest",
    schema: weeklyDigestSchema,
    systemInstruction: DIGEST_SYSTEM_INSTRUCTION,
    prompt: buildDigestPrompt(stats),
  });

  const dashboardUrl = `${process.env.APP_BASE_URL ?? "http://localhost:3000"}/dashboard`;
  const studentFirstName = extractStudentFirstName(user.name);
  const summaryHtml = await renderWeeklyDigestHtml({
    firstName: studentFirstName,
    paragraphs: aiContent.bodyParagraphs,
    dashboardUrl,
  });

  return {
    subject: aiContent.subject,
    summaryHtml,
    recipientEmail: user.email,
    studentFirstName,
  };
}

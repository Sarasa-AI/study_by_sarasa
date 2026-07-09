import { getWeeklyPerformanceContext } from "@/lib/analytics-service";
import { buildDigestPromptStats } from "@/lib/digest-helpers";
import { generateWeeklyDigest } from "@/lib/digest-service";
import { sendEmail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export async function GET(request: Request) {
  if (isProduction()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const shouldSend = searchParams.get("send") === "true";

  if (!userId) {
    return NextResponse.json({ error: "userId query parameter is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      currentStreak: true,
      longestStreak: true,
      lastQuizCompletedAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const weeklyContext = await getWeeklyPerformanceContext(userId);
  const stats = buildDigestPromptStats(weeklyContext, {
    currentStreak: user.currentStreak,
    longestStreak: user.longestStreak,
    lastQuizCompletedAt: user.lastQuizCompletedAt,
  });

  const digest = await generateWeeklyDigest(userId);

  if (!digest) {
    return NextResponse.json({
      skipped: true,
      reason: !user.email ? "no_email" : "no_recent_activity",
      recipientEmail: user.email,
      stats,
    });
  }

  let emailResult: { id: string } | null = null;
  if (shouldSend) {
    emailResult = await sendEmail(digest.recipientEmail, digest.subject, digest.summaryHtml);
  }

  return NextResponse.json({
    skipped: false,
    subject: digest.subject,
    recipientEmail: digest.recipientEmail,
    studentFirstName: digest.studentFirstName,
    htmlPreview: digest.summaryHtml,
    sent: shouldSend,
    emailId: emailResult?.id ?? null,
    dryRun: process.env.MAIL_DRY_RUN === "true",
    stats,
  });
}

import { generateWeeklyDigest } from "@/lib/digest-service";
import { verifyCronSecret } from "@/lib/cron-auth";
import { getLogger } from "@/lib/logger";
import { sendEmail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { withRequestContext } from "@/lib/request-context";
import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

export const maxDuration = 300;

const PER_USER_TIMEOUT_MS = 30_000;

type DigestRunStatus = "sent" | "skipped" | "failed";

type DigestRunResult = {
  userId: string;
  status: DigestRunStatus;
  error?: string;
};

async function withPerUserTimeout<T>(promise: Promise<T>, userId: string): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Weekly digest timed out for user ${userId}`));
    }, PER_USER_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function runWeeklyDigestJob(): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }

  const jobId = crypto.randomUUID();
  const startedAt = Date.now();

  return withRequestContext({ requestId: jobId, jobId, operation: "weekly-digest" }, async () => {
    const logger = getLogger();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const students = await prisma.user.findMany({
      where: {
        role: Role.STUDENT,
        email: { not: null },
        lastQuizCompletedAt: { gte: sevenDaysAgo },
      },
      select: { id: true },
    });

    logger.info(
      {
        event: "cron.weekly_digest.start",
        jobId,
        candidateCount: students.length,
      },
      "Weekly digest job started",
    );

    const results: DigestRunResult[] = [];

    for (const student of students) {
      try {
        const digest = await withPerUserTimeout(
          generateWeeklyDigest(student.id),
          student.id,
        );

        if (!digest) {
          results.push({ userId: student.id, status: "skipped" });
          logger.info(
            {
              event: "cron.weekly_digest.user",
              jobId,
              userId: student.id,
              status: "skipped",
            },
            "Weekly digest user skipped",
          );
          continue;
        }

        await sendEmail(digest.recipientEmail, digest.subject, digest.summaryHtml);
        results.push({ userId: student.id, status: "sent" });
        logger.info(
          {
            event: "cron.weekly_digest.user",
            jobId,
            userId: student.id,
            status: "sent",
          },
          "Weekly digest user sent",
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        results.push({
          userId: student.id,
          status: "failed",
          error: errorMessage,
        });
        logger.error(
          {
            event: "cron.weekly_digest.user_failed",
            jobId,
            userId: student.id,
            errorType: error instanceof Error ? error.name : "UnknownError",
            errorMessage,
          },
          "Weekly digest user failed",
        );
      }
    }

    const sent = results.filter((result) => result.status === "sent").length;
    const skipped = results.filter((result) => result.status === "skipped").length;
    const failed = results.filter((result) => result.status === "failed").length;

    logger.info(
      {
        event: "cron.weekly_digest.complete",
        jobId,
        sent,
        skipped,
        failed,
        durationMs: Date.now() - startedAt,
      },
      "Weekly digest job completed",
    );

    return NextResponse.json({
      sent,
      skipped,
      failed,
      results,
    });
  });
}

function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

async function handleCronRequest(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  if (!verifyCronSecret(authHeader, process.env.CRON_SECRET)) {
    return unauthorizedResponse();
  }

  return runWeeklyDigestJob();
}

export async function GET(request: Request) {
  return handleCronRequest(request);
}

export async function POST(request: Request) {
  return handleCronRequest(request);
}

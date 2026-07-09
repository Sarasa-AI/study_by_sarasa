import { createHash } from "node:crypto";
import { Resend } from "resend";
import { getLogger } from "@/lib/logger";

const DEFAULT_SEND_EMAIL_TIMEOUT_MS = 10_000;

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY environment variable is required");
  }

  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }

  return resendClient;
}

function getMailFrom(): string {
  const mailFrom = process.env.MAIL_FROM;
  if (!mailFrom) {
    throw new Error("MAIL_FROM environment variable is required");
  }

  return mailFrom;
}

function getSendEmailTimeoutMs(): number {
  const configured = Number(process.env.SEND_EMAIL_TIMEOUT_MS);
  if (!Number.isFinite(configured) || configured <= 0) {
    return DEFAULT_SEND_EMAIL_TIMEOUT_MS;
  }

  return configured;
}

function hashRecipient(email: string): string {
  return createHash("sha256").update(email).digest("hex");
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string,
): Promise<{ id: string }> {
  const logger = getLogger();
  const startedAt = Date.now();
  const recipientHash = hashRecipient(to);

  if (process.env.MAIL_DRY_RUN === "true") {
    logger.info(
      {
        event: "mail.send.dry_run",
        recipientHash,
        subjectLength: subject.length,
      },
      "Email dry run",
    );
    return { id: "dry-run" };
  }

  const resend = getResendClient();
  const from = getMailFrom();
  const timeoutMs = getSendEmailTimeoutMs();

  try {
    const result = await withTimeout(
      resend.emails.send({
        from,
        to,
        subject,
        html: htmlBody,
      }),
      timeoutMs,
      "Resend email send",
    );

    if (result.error) {
      throw new Error(result.error.message);
    }

    if (!result.data?.id) {
      throw new Error("Email provider did not return a message id");
    }

    logger.info(
      {
        event: "mail.send.success",
        recipientHash,
        latencyMs: Date.now() - startedAt,
        messageId: result.data.id,
      },
      "Email sent",
    );

    return { id: result.data.id };
  } catch (error) {
    logger.error(
      {
        event: "mail.send.failed",
        recipientHash,
        latencyMs: Date.now() - startedAt,
        errorType: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
      "Email send failed",
    );
    throw error;
  }
}

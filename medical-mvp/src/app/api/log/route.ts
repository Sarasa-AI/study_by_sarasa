import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { getLogger } from "@/lib/logger";
import { sanitizeLogContext } from "@/lib/log-sanitize";
import { runWithRequestId } from "@/lib/request-context";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 32_768;
const MAX_STRING_LENGTH = 4_000;

const clientLogSchema = z.object({
  message: z.string().min(1).max(MAX_STRING_LENGTH),
  digest: z.string().max(200).optional(),
  stack: z.string().max(MAX_STRING_LENGTH).optional(),
  componentStack: z.string().max(MAX_STRING_LENGTH).optional(),
  url: z.string().max(2_000).optional(),
  source: z.string().max(100).optional(),
});

function truncate(value: string | undefined, max = MAX_STRING_LENGTH): string | undefined {
  if (!value) return undefined;
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...[truncated]`;
}

export async function POST(request: Request) {
  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false, error: "Payload too large" }, { status: 413 });
    }
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: "Payload too large" }, { status: 413 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = clientLogSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  const sessionUser = await getSessionUser();

  await runWithRequestId(
    async () => {
      const payload = sanitizeLogContext({
        event: "client.error",
        source: parsed.data.source ?? "client",
        message: truncate(parsed.data.message),
        digest: truncate(parsed.data.digest, 200),
        stack: truncate(parsed.data.stack),
        componentStack: truncate(parsed.data.componentStack),
        url: truncate(parsed.data.url, 2_000),
        ...(sessionUser?.id ? { userId: sessionUser.id } : {}),
      });

      getLogger().error(payload, "Client-reported error");
    },
    {
      operation: "client-log",
      ...(sessionUser?.id ? { userId: sessionUser.id } : {}),
    },
  );

  return NextResponse.json({ ok: true });
}

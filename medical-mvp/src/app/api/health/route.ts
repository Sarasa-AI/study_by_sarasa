import { NextResponse } from "next/server";
import { getLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type HealthCheckResult = {
  ok: boolean;
  latencyMs: number;
  error?: string;
};

type HealthStatus = "healthy" | "degraded" | "unhealthy";

const DB_TIMEOUT_MS = 3_000;
const OPENROUTER_TIMEOUT_MS = 5_000;
const RESEND_TIMEOUT_MS = 5_000;

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

async function checkDatabase(): Promise<HealthCheckResult> {
  const startedAt = Date.now();

  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, DB_TIMEOUT_MS, "Database health check");
    return {
      ok: true,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown database error",
    };
  }
}

async function checkOpenRouter(): Promise<HealthCheckResult> {
  const startedAt = Date.now();
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: "OPENROUTER_API_KEY is not configured",
    };
  }

  try {
    const response = await withTimeout(
      fetch("https://openrouter.ai/api/v1/models", {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        cache: "no-store",
      }),
      OPENROUTER_TIMEOUT_MS,
      "OpenRouter health check",
    );

    if (!response.ok) {
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        error: `OpenRouter returned status ${response.status}`,
      };
    }

    return {
      ok: true,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown OpenRouter error",
    };
  }
}

async function checkResend(): Promise<HealthCheckResult> {
  const startedAt = Date.now();
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: "RESEND_API_KEY is not configured",
    };
  }

  try {
    const response = await withTimeout(
      fetch("https://api.resend.com/domains", {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        cache: "no-store",
      }),
      RESEND_TIMEOUT_MS,
      "Resend health check",
    );

    if (!response.ok) {
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        error: `Resend returned status ${response.status}`,
      };
    }

    return {
      ok: true,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown Resend error",
    };
  }
}

function resolveOverallStatus(checks: {
  database: HealthCheckResult;
  openrouter: HealthCheckResult;
  resend: HealthCheckResult;
}): HealthStatus {
  if (!checks.database.ok) {
    return "unhealthy";
  }

  if (!checks.openrouter.ok || !checks.resend.ok) {
    return "degraded";
  }

  return "healthy";
}

export async function GET() {
  const startedAt = Date.now();
  const [database, openrouter, resend] = await Promise.all([
    checkDatabase(),
    checkOpenRouter(),
    checkResend(),
  ]);

  const checks = { database, openrouter, resend };
  const status = resolveOverallStatus(checks);
  const timestamp = new Date().toISOString();

  getLogger().info(
    {
      event: "health.check",
      status,
      checks,
      durationMs: Date.now() - startedAt,
    },
    "Health check completed",
  );

  const httpStatus = status === "unhealthy" ? 503 : 200;

  return NextResponse.json(
    {
      status,
      checks,
      timestamp,
    },
    { status: httpStatus },
  );
}

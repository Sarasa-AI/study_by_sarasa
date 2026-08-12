import { APIConnectionError, APIError } from "openai";
import { getLogger } from "@/lib/logger";
import { serializeError } from "@/lib/serialize-error";

export type RetryOptions = {
  /** Retries after the first failure (default 3 → up to 4 attempts). */
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  operation: string;
  isRetryable?: (error: unknown) => boolean;
  /** Injectable sleep for tests. */
  sleep?: (ms: number) => Promise<void>;
  /** Injectable RNG for tests (0..1). */
  random?: () => number;
};

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 8_000;

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * True for network failures, rate limits (429), and 5xx HTTP errors from the OpenAI SDK.
 */
export function isTransientOpenAIError(error: unknown): boolean {
  if (error instanceof APIConnectionError) {
    return true;
  }

  if (error instanceof APIError) {
    const status = error.status;
    if (status === 429) return true;
    if (typeof status === "number" && status >= 500) return true;
    return false;
  }

  return isTransientGenericError(error);
}

/**
 * Heuristic for Resend / timeout / generic network failures (no OpenAI types).
 */
export function isTransientGenericError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  if (message.includes("timed out") || message.includes("timeout")) {
    return true;
  }
  if (
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("enotfound") ||
    message.includes("network") ||
    message.includes("fetch failed") ||
    message.includes("socket hang up")
  ) {
    return true;
  }

  const status = (error as Error & { status?: number; statusCode?: number }).status
    ?? (error as Error & { statusCode?: number }).statusCode;
  if (status === 429) return true;
  if (typeof status === "number" && status >= 500) return true;

  return false;
}

/**
 * Prefer Retry-After (seconds or HTTP-date) when present on OpenAI APIError; otherwise exponential backoff + jitter.
 */
export function computeRetryDelayMs(
  error: unknown,
  attempt: number,
  options: {
    baseDelayMs: number;
    maxDelayMs: number;
    random: () => number;
  },
): number {
  const retryAfterMs = readRetryAfterMs(error);
  if (retryAfterMs !== null) {
    return Math.min(options.maxDelayMs, retryAfterMs);
  }

  const exponential = options.baseDelayMs * 2 ** attempt;
  const capped = Math.min(options.maxDelayMs, exponential);
  const jitter = capped * options.random() * 0.25;
  return Math.floor(capped + jitter);
}

function readRetryAfterMs(error: unknown): number | null {
  if (!(error instanceof APIError)) {
    return null;
  }

  const headers = (error as APIError & { headers?: Headers | Record<string, string> }).headers;
  if (!headers) {
    return null;
  }

  let raw: string | null = null;
  if (typeof (headers as Headers).get === "function") {
    raw = (headers as Headers).get("retry-after");
  } else {
    const record = headers as Record<string, string>;
    raw = record["retry-after"] ?? record["Retry-After"] ?? null;
  }

  if (!raw) {
    return null;
  }

  const asSeconds = Number(raw);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return asSeconds * 1000;
  }

  const asDate = Date.parse(raw);
  if (!Number.isNaN(asDate)) {
    const delta = asDate - Date.now();
    return delta > 0 ? delta : 0;
  }

  return null;
}

/**
 * Run `fn` with exponential backoff + jitter on transient failures.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const isRetryable = options.isRetryable ?? isTransientOpenAIError;
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;
  const logger = getLogger();

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const retriesLeft = maxRetries - attempt;
      if (retriesLeft <= 0 || !isRetryable(error)) {
        throw error;
      }

      const delayMs = computeRetryDelayMs(error, attempt, {
        baseDelayMs,
        maxDelayMs,
        random,
      });

      logger.warn(
        {
          event: "retry.attempt",
          operation: options.operation,
          attempt: attempt + 1,
          maxRetries,
          delayMs,
          err: serializeError(error),
        },
        `${options.operation} retrying after failure`,
      );

      await sleep(delayMs);
    }
  }

  throw lastError;
}

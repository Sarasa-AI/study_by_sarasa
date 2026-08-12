import OpenAI, { APIConnectionError, APIError } from "openai";
import { type ZodError, type ZodSchema } from "zod";
import { getLogger } from "@/lib/logger";
import { getRequestId } from "@/lib/request-context";
import { isTransientOpenAIError, withRetry } from "@/lib/retry";
import { serializeError } from "@/lib/serialize-error";

export type AIGatewayErrorCode =
  | "RATE_LIMIT"
  | "NETWORK_ERROR"
  | "PARSE_ERROR"
  | "VALIDATION_ERROR"
  | "API_ERROR";

export type AIGatewayOperation = "case-generation" | "mentor-reply" | "weekly-digest";

const JSON_ENFORCEMENT_SUFFIX =
  "Respond with a single valid JSON object only. No markdown fences, no prose outside JSON.";

/** Default OpenRouter chat model when env vars are unset. */
export const DEFAULT_OPENROUTER_MODEL = "openai/gpt-4o-mini";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
  throw new Error("OPENROUTER_API_KEY environment variable is required");
}

const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": process.env.APP_BASE_URL ?? "http://localhost:3000",
    "X-Title": "medical-mvp",
  },
});

/** Resolve the OpenRouter model id for chat/completions requests. */
export function resolveOpenRouterModel(explicit?: string): string {
  const model =
    explicit?.trim() ||
    process.env.OPENROUTER_DEFAULT_MODEL?.trim() ||
    process.env.OPENROUTER_MODEL?.trim() ||
    DEFAULT_OPENROUTER_MODEL;
  return model;
}

export class AIGatewayError extends Error {
  readonly code: AIGatewayErrorCode;
  readonly cause?: unknown;

  constructor(code: AIGatewayErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "AIGatewayError";
    this.code = code;
    this.cause = cause;
  }
}

export class AIValidationError extends AIGatewayError {
  constructor(message: string, cause?: unknown) {
    super("VALIDATION_ERROR", message, cause);
    this.name = "AIValidationError";
  }
}

type GenerateStructuredDataParams<T> = {
  prompt: string;
  schema: ZodSchema<T>;
  systemInstruction?: string;
  model?: string;
  /** Max completion tokens passed to OpenRouter as `max_tokens`. */
  maxTokens?: number;
  operation: AIGatewayOperation;
  /**
   * Optional hook invoked on the raw parsed object before Zod validation.
   * Use it to remap alternative key names the model may produce, or to fill
   * in empty defaults for optional fields — preventing minor model output
   * drift from causing hard validation crashes.
   */
  patchParsed?: (raw: unknown) => unknown;
};

function formatZodIssues(error: ZodError): string {
  return error.errors.map((issue) => issue.message).join("; ");
}

function buildSystemContent(systemInstruction?: string): string {
  if (systemInstruction) {
    return `${systemInstruction}\n\n${JSON_ENFORCEMENT_SUFFIX}`;
  }
  return JSON_ENFORCEMENT_SUFFIX;
}

function mapApiError(error: APIError): AIGatewayError {
  if (error.status === 429) {
    return new AIGatewayError("RATE_LIMIT", "OpenRouter rate limit exceeded", error);
  }
  if (typeof error.status === "number" && error.status >= 500) {
    return new AIGatewayError("API_ERROR", `OpenRouter server error (${error.status})`, error);
  }
  return new AIGatewayError("API_ERROR", error.message, error);
}

function getParsedTopLevelKeys(parsed: unknown): string[] | undefined {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return undefined;
  }

  return Object.keys(parsed);
}

function logGatewaySuccess(params: {
  operation: AIGatewayOperation;
  model: string;
  latencyMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
}): void {
  getLogger().info(
    {
      event: "ai.gateway.success",
      operation: params.operation,
      model: params.model,
      latencyMs: params.latencyMs,
      promptTokens: params.promptTokens,
      completionTokens: params.completionTokens,
      totalTokens: params.totalTokens,
      requestId: getRequestId(),
    },
    "AI gateway request completed",
  );
}

function logGatewayFailure(params: {
  operation: AIGatewayOperation;
  model: string;
  latencyMs: number;
  errorCode: AIGatewayErrorCode;
  status?: number;
  rawModelOutput?: string;
  zodIssues?: string;
  parsedKeys?: string[];
  error?: unknown;
}): void {
  getLogger().error(
    {
      event: "ai.gateway.failure",
      operation: params.operation,
      model: params.model,
      latencyMs: params.latencyMs,
      errorCode: params.errorCode,
      status: params.status,
      rawModelOutput: params.rawModelOutput,
      zodIssues: params.zodIssues,
      parsedKeys: params.parsedKeys,
      requestId: getRequestId(),
      ...(params.error !== undefined ? { err: serializeError(params.error) } : {}),
    },
    "AI gateway request failed",
  );
}

/**
 * Strips markdown code fences and extracts the outermost JSON object from a
 * model response that may include prose, fences, or leading/trailing garbage.
 */
function sanitizeJsonResponse(raw: string): string {
  let text = raw.trim();

  // Remove all markdown code fences (```json ... ``` or ``` ... ```)
  text = text.replace(/^```(?:json|JSON)?\s*/m, "").replace(/\s*```\s*$/m, "");
  text = text.trim();

  // Extract from the first '{' to the last '}' to drop any surrounding prose
  const firstBrace = text.indexOf("{");
  if (firstBrace !== -1) {
    const lastBrace = text.lastIndexOf("}");
    if (lastBrace > firstBrace) {
      return text.slice(firstBrace, lastBrace + 1);
    }
    // No closing brace — return from first brace onward for the repair pass
    return text.slice(firstBrace);
  }

  return text;
}

/**
 * Best-effort repair of a truncated JSON string.
 * Closes any unclosed string literals, arrays, and objects so that
 * JSON.parse has a fighting chance on a response cut off mid-stream.
 */
function repairTruncatedJson(text: string): string {
  const stack: string[] = [];
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") stack.pop();
  }

  // Close an unterminated string value first
  let repaired = inString ? text + '"' : text;
  // Then close unclosed objects/arrays in LIFO order
  for (let i = stack.length - 1; i >= 0; i--) {
    repaired += stack[i] === "{" ? "}" : "]";
  }
  return repaired;
}

export async function generateStructuredData<T>(
  params: GenerateStructuredDataParams<T>,
): Promise<T> {
  const model = resolveOpenRouterModel(params.model);

  const startedAt = Date.now();

  try {
    const maxTokens =
      typeof params.maxTokens === "number" && Number.isFinite(params.maxTokens)
        ? Math.max(1, Math.floor(params.maxTokens))
        : undefined;

    const completion = await withRetry(
      () =>
        openrouter.chat.completions.create({
          model,
          messages: [
            { role: "system", content: buildSystemContent(params.systemInstruction) },
            { role: "user", content: params.prompt },
          ],
          response_format: { type: "json_object" },
          ...(maxTokens !== undefined ? { max_tokens: maxTokens } : {}),
        }),
      {
        operation: `ai.gateway.${params.operation}`,
        isRetryable: isTransientOpenAIError,
      },
    );

    const latencyMs = Date.now() - startedAt;

    const content = completion.choices[0]?.message?.content;
    if (!content?.trim()) {
      const error = new AIGatewayError("PARSE_ERROR", "Model returned empty response");
      logGatewayFailure({
        operation: params.operation,
        model,
        latencyMs,
        errorCode: error.code,
        error,
      });
      throw error;
    }

    let parsed: unknown;
    try {
      const sanitized = sanitizeJsonResponse(content);
      try {
        parsed = JSON.parse(sanitized);
      } catch (_firstParseError) {
        // Second attempt: repair truncated JSON (unterminated strings / missing
        // closing brackets caused by token-limit cutoff or streaming artifacts).
        parsed = JSON.parse(repairTruncatedJson(sanitized));
      }
    } catch (parseError) {
      const error = new AIGatewayError("PARSE_ERROR", "Failed to parse model response as JSON", parseError);
      logGatewayFailure({
        operation: params.operation,
        model,
        latencyMs,
        errorCode: error.code,
        rawModelOutput: content,
        error,
      });
      throw error;
    }

    // Apply optional field-patching hook before validation.  The hook can
    // remap alternative key names or fill empty defaults so that minor model
    // output drift never produces a hard VALIDATION_ERROR crash.
    const coerced = params.patchParsed ? params.patchParsed(parsed) : parsed;

    const result = params.schema.safeParse(coerced);
    if (!result.success) {
      const error = new AIValidationError(
        `Response failed schema validation: ${formatZodIssues(result.error)}`,
        result.error,
      );
      logGatewayFailure({
        operation: params.operation,
        model,
        latencyMs,
        errorCode: error.code,
        zodIssues: formatZodIssues(result.error),
        parsedKeys: getParsedTopLevelKeys(parsed), // raw keys — for debugging
        error,
      });
      throw error;
    }

    logGatewaySuccess({
      operation: params.operation,
      model,
      latencyMs,
      promptTokens: completion.usage?.prompt_tokens ?? null,
      completionTokens: completion.usage?.completion_tokens ?? null,
      totalTokens: completion.usage?.total_tokens ?? null,
    });

    return result.data;
  } catch (error) {
    const latencyMs = Date.now() - startedAt;

    if (error instanceof AIGatewayError) {
      if (error.code !== "PARSE_ERROR" && error.code !== "VALIDATION_ERROR") {
        logGatewayFailure({
          operation: params.operation,
          model,
          latencyMs,
          errorCode: error.code,
          error,
        });
      }
      throw error;
    }

    if (error instanceof APIConnectionError) {
      const gatewayError = new AIGatewayError("NETWORK_ERROR", "Failed to connect to OpenRouter", error);
      logGatewayFailure({
        operation: params.operation,
        model,
        latencyMs,
        errorCode: gatewayError.code,
        error: gatewayError,
      });
      throw gatewayError;
    }

    if (error instanceof APIError) {
      const gatewayError = mapApiError(error);
      logGatewayFailure({
        operation: params.operation,
        model,
        latencyMs,
        errorCode: gatewayError.code,
        status: error.status,
        error: gatewayError,
      });
      throw gatewayError;
    }

    const gatewayError = new AIGatewayError(
      "API_ERROR",
      error instanceof Error ? error.message : "Unknown AI gateway error",
      error,
    );
    logGatewayFailure({
      operation: params.operation,
      model,
      latencyMs,
      errorCode: gatewayError.code,
      error: gatewayError,
    });
    throw gatewayError;
  }
}

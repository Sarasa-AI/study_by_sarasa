import OpenAI, { APIConnectionError, APIError } from "openai";
import { type ZodError, type ZodSchema } from "zod";
import { getLogger } from "@/lib/logger";
import { getRequestId } from "@/lib/request-context";

export type AIGatewayErrorCode =
  | "RATE_LIMIT"
  | "NETWORK_ERROR"
  | "PARSE_ERROR"
  | "VALIDATION_ERROR"
  | "API_ERROR";

export type AIGatewayOperation = "case-generation" | "mentor-reply" | "weekly-digest";

const JSON_ENFORCEMENT_SUFFIX =
  "Respond with a single valid JSON object only. No markdown fences, no prose outside JSON.";

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
  operation: AIGatewayOperation;
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
    },
    "AI gateway request failed",
  );
}

export async function generateStructuredData<T>(
  params: GenerateStructuredDataParams<T>,
): Promise<T> {
  const model = params.model ?? process.env.OPENROUTER_DEFAULT_MODEL;
  if (!model) {
    const error = new AIGatewayError("API_ERROR", "No model configured");
    logGatewayFailure({
      operation: params.operation,
      model: "unknown",
      latencyMs: 0,
      errorCode: error.code,
    });
    throw error;
  }

  const startedAt = Date.now();

  try {
    const completion = await openrouter.chat.completions.create({
      model,
      messages: [
        { role: "system", content: buildSystemContent(params.systemInstruction) },
        { role: "user", content: params.prompt },
      ],
      response_format: { type: "json_object" },
    });

    const latencyMs = Date.now() - startedAt;

    const content = completion.choices[0]?.message?.content;
    if (!content?.trim()) {
      const error = new AIGatewayError("PARSE_ERROR", "Model returned empty response");
      logGatewayFailure({
        operation: params.operation,
        model,
        latencyMs,
        errorCode: error.code,
      });
      throw error;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      const error = new AIGatewayError("PARSE_ERROR", "Failed to parse model response as JSON", parseError);
      logGatewayFailure({
        operation: params.operation,
        model,
        latencyMs,
        errorCode: error.code,
        rawModelOutput: content,
      });
      throw error;
    }

    const result = params.schema.safeParse(parsed);
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
        parsedKeys: getParsedTopLevelKeys(parsed),
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
    });
    throw gatewayError;
  }
}

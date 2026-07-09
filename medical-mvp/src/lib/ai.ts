import OpenAI, { APIConnectionError, APIError } from "openai";
import { type ZodError, type ZodSchema } from "zod";

export type AIGatewayErrorCode =
  | "RATE_LIMIT"
  | "NETWORK_ERROR"
  | "PARSE_ERROR"
  | "VALIDATION_ERROR"
  | "API_ERROR";

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

export async function generateStructuredData<T>(
  params: GenerateStructuredDataParams<T>,
): Promise<T> {
  const model = params.model ?? process.env.OPENROUTER_DEFAULT_MODEL;
  if (!model) {
    throw new AIGatewayError("API_ERROR", "No model configured");
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

    console.info("[ai-gateway]", {
      model,
      latencyMs,
      promptTokens: completion.usage?.prompt_tokens ?? null,
      completionTokens: completion.usage?.completion_tokens ?? null,
      totalTokens: completion.usage?.total_tokens ?? null,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content?.trim()) {
      throw new AIGatewayError("PARSE_ERROR", "Model returned empty response");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw new AIGatewayError("PARSE_ERROR", "Failed to parse model response as JSON", error);
    }

    const result = params.schema.safeParse(parsed);
    if (!result.success) {
      throw new AIValidationError(
        `Response failed schema validation: ${formatZodIssues(result.error)}`,
        result.error,
      );
    }

    return result.data;
  } catch (error) {
    if (error instanceof AIGatewayError) {
      throw error;
    }
    if (error instanceof APIConnectionError) {
      throw new AIGatewayError("NETWORK_ERROR", "Failed to connect to OpenRouter", error);
    }
    if (error instanceof APIError) {
      throw mapApiError(error);
    }
    throw new AIGatewayError(
      "API_ERROR",
      error instanceof Error ? error.message : "Unknown AI gateway error",
      error,
    );
  }
}

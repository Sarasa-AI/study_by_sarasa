import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mockCreate = vi.fn();

vi.mock("openai", () => {
  class APIConnectionError extends Error {
    name = "APIConnectionError";
  }

  class APIError extends Error {
    status: number;
    headers?: Record<string, string>;

    constructor(message: string, status: number, headers?: Record<string, string>) {
      super(message);
      this.status = status;
      this.name = "APIError";
      this.headers = headers;
    }
  }

  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
    APIConnectionError,
    APIError,
  };
});

vi.mock("@/lib/retry", async () => {
  const actual = await vi.importActual<typeof import("@/lib/retry")>("@/lib/retry");
  return {
    ...actual,
    withRetry: async <T>(
      fn: () => Promise<T>,
      options: Parameters<typeof actual.withRetry>[1],
    ) =>
      actual.withRetry(fn, {
        ...options,
        sleep: async () => undefined,
        random: () => 0,
      }),
  };
});

describe("generateStructuredData", () => {
  beforeEach(() => {
    vi.resetModules();
    mockCreate.mockReset();
    process.env.OPENROUTER_API_KEY = "test-key";
    process.env.OPENROUTER_DEFAULT_MODEL = "test/model";
  });

  it("logs and throws parse errors for malformed JSON responses", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: "not-json" } }],
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
    });

    const { generateStructuredData, AIGatewayError } = await import("@/lib/ai");
    const schema = z.object({ title: z.string() });

    await expect(
      generateStructuredData({
        operation: "case-generation",
        prompt: "test prompt",
        schema,
      }),
    ).rejects.toBeInstanceOf(AIGatewayError);
  });

  it("logs and throws validation errors for schema mismatches", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ title: 123 }) } }],
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
    });

    const { generateStructuredData, AIValidationError } = await import("@/lib/ai");
    const schema = z.object({ title: z.string() });

    await expect(
      generateStructuredData({
        operation: "case-generation",
        prompt: "test prompt",
        schema,
      }),
    ).rejects.toBeInstanceOf(AIValidationError);
  });

  it("returns parsed data for valid responses", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ title: "Case A" }) } }],
      usage: { prompt_tokens: 4, completion_tokens: 5, total_tokens: 9 },
    });

    const { generateStructuredData } = await import("@/lib/ai");
    const schema = z.object({ title: z.string() });

    await expect(
      generateStructuredData({
        operation: "case-generation",
        prompt: "test prompt",
        schema,
      }),
    ).resolves.toEqual({ title: "Case A" });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "test/model" }),
    );
  });

  it("falls back to openai/gpt-4o-mini when no model env vars are set", async () => {
    delete process.env.OPENROUTER_DEFAULT_MODEL;
    delete process.env.OPENROUTER_MODEL;

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ title: "Case B" }) } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });

    const { generateStructuredData } = await import("@/lib/ai");
    const schema = z.object({ title: z.string() });

    await expect(
      generateStructuredData({
        operation: "case-generation",
        prompt: "test prompt",
        schema,
      }),
    ).resolves.toEqual({ title: "Case B" });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "openai/gpt-4o-mini" }),
    );
  });

  it("maps maxTokens to OpenRouter max_tokens", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ title: "Case C" }) } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });

    const { generateStructuredData } = await import("@/lib/ai");
    const schema = z.object({ title: z.string() });

    await expect(
      generateStructuredData({
        operation: "case-generation",
        prompt: "test prompt",
        schema,
        maxTokens: 4000,
      }),
    ).resolves.toEqual({ title: "Case C" });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "test/model", max_tokens: 4000 }),
    );
  });

  it("retries transient 429 errors then returns parsed data", async () => {
    const { APIError } = await import("openai");
    const RateLimitError = APIError as unknown as new (
      message: string,
      status: number,
    ) => InstanceType<typeof APIError>;

    mockCreate
      .mockRejectedValueOnce(new RateLimitError("rate limited", 429))
      .mockRejectedValueOnce(new RateLimitError("rate limited", 429))
      .mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify({ title: "After Retry" }) } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      });

    const { generateStructuredData } = await import("@/lib/ai");
    const schema = z.object({ title: z.string() });

    await expect(
      generateStructuredData({
        operation: "case-generation",
        prompt: "test prompt",
        schema,
      }),
    ).resolves.toEqual({ title: "After Retry" });

    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it("maps exhausted rate-limit retries to RATE_LIMIT", async () => {
    const { APIError } = await import("openai");
    const RateLimitError = APIError as unknown as new (
      message: string,
      status: number,
    ) => InstanceType<typeof APIError>;

    mockCreate.mockRejectedValue(new RateLimitError("rate limited", 429));

    const { generateStructuredData, AIGatewayError } = await import("@/lib/ai");
    const schema = z.object({ title: z.string() });

    try {
      await generateStructuredData({
        operation: "case-generation",
        prompt: "test prompt",
        schema,
      });
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(AIGatewayError);
      expect((error as InstanceType<typeof AIGatewayError>).code).toBe("RATE_LIMIT");
    }

    // initial + 3 retries
    expect(mockCreate).toHaveBeenCalledTimes(4);
  });
});

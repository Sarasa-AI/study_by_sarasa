import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mockCreate = vi.fn();

vi.mock("openai", () => {
  class APIConnectionError extends Error {
    name = "APIConnectionError";
  }

  class APIError extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.status = status;
      this.name = "APIError";
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
  });
});

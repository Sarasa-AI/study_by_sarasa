import { beforeEach, describe, expect, it } from "vitest";

describe("mapAiErrorToClientMessage", () => {
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "test-key";
  });

  it("maps validation errors to Farsi schema mismatch message", async () => {
    const { AIValidationError } = await import("@/lib/ai");
    const { mapAiErrorToClientMessage } = await import("@/lib/ai-errors");

    const message = mapAiErrorToClientMessage(
      new AIValidationError("Response failed schema validation"),
    );
    expect(message).toBe("خروجی هوش مصنوعی با ساختار مورد انتظار مطابقت ندارد");
  });

  it("maps parse errors to Farsi parse message", async () => {
    const { AIGatewayError } = await import("@/lib/ai");
    const { mapAiErrorToClientMessage } = await import("@/lib/ai-errors");

    const message = mapAiErrorToClientMessage(
      new AIGatewayError("PARSE_ERROR", "Failed to parse model response as JSON"),
    );
    expect(message).toBe("پاسخ هوش مصنوعی قابل پردازش نبود");
  });

  it("maps rate limit errors to Farsi rate limit message", async () => {
    const { AIGatewayError } = await import("@/lib/ai");
    const { mapAiErrorToClientMessage } = await import("@/lib/ai-errors");

    const message = mapAiErrorToClientMessage(
      new AIGatewayError("RATE_LIMIT", "OpenRouter rate limit exceeded"),
    );
    expect(message).toBe("محدودیت درخواست هوش مصنوعی؛ لطفاً کمی بعد تلاش کنید");
  });

  it("returns generic server error for unknown errors", async () => {
    const { mapAiErrorToClientMessage } = await import("@/lib/ai-errors");
    expect(mapAiErrorToClientMessage(new Error("boom"))).toBe("خطای سرور");
  });
});

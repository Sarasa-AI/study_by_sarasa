import { beforeEach, describe, expect, it, vi } from "vitest";

const mockWarn = vi.fn();

vi.mock("@/lib/logger", () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: mockWarn,
    error: vi.fn(),
    child: vi.fn(),
  }),
}));

describe("withRetry", () => {
  beforeEach(() => {
    vi.resetModules();
    mockWarn.mockReset();
  });

  it("returns on first success without sleeping", async () => {
    const sleep = vi.fn();
    const { withRetry } = await import("@/lib/retry");

    const result = await withRetry(async () => "ok", {
      operation: "test.op",
      sleep,
      maxRetries: 3,
    });

    expect(result).toBe("ok");
    expect(sleep).not.toHaveBeenCalled();
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it("retries retryable errors then succeeds", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const { withRetry } = await import("@/lib/retry");

    let calls = 0;
    const result = await withRetry(
      async () => {
        calls += 1;
        if (calls < 3) {
          throw new Error("network timeout");
        }
        return "recovered";
      },
      {
        operation: "test.retry",
        sleep,
        random: () => 0,
        maxRetries: 3,
        baseDelayMs: 100,
        isRetryable: () => true,
      },
    );

    expect(result).toBe("recovered");
    expect(calls).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(mockWarn).toHaveBeenCalledTimes(2);
  });

  it("exhausts retries and throws the last error", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const { withRetry } = await import("@/lib/retry");

    await expect(
      withRetry(
        async () => {
          throw new Error("still failing");
        },
        {
          operation: "test.exhaust",
          sleep,
          random: () => 0,
          maxRetries: 2,
          baseDelayMs: 50,
          isRetryable: () => true,
        },
      ),
    ).rejects.toThrow("still failing");

    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-retryable errors", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const { withRetry } = await import("@/lib/retry");

    await expect(
      withRetry(
        async () => {
          throw new Error("validation failed");
        },
        {
          operation: "test.noretry",
          sleep,
          maxRetries: 3,
          isRetryable: () => false,
        },
      ),
    ).rejects.toThrow("validation failed");

    expect(sleep).not.toHaveBeenCalled();
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it("grows delay exponentially with attempt", async () => {
    const delays: number[] = [];
    const sleep = vi.fn(async (ms: number) => {
      delays.push(ms);
    });
    const { withRetry } = await import("@/lib/retry");

    await expect(
      withRetry(
        async () => {
          throw new Error("fail");
        },
        {
          operation: "test.backoff",
          sleep,
          random: () => 0,
          maxRetries: 3,
          baseDelayMs: 100,
          maxDelayMs: 10_000,
          isRetryable: () => true,
        },
      ),
    ).rejects.toThrow("fail");

    expect(delays).toEqual([100, 200, 400]);
  });

  it("caps delay at maxDelayMs", async () => {
    const delays: number[] = [];
    const sleep = vi.fn(async (ms: number) => {
      delays.push(ms);
    });
    const { withRetry } = await import("@/lib/retry");

    await expect(
      withRetry(
        async () => {
          throw new Error("fail");
        },
        {
          operation: "test.cap",
          sleep,
          random: () => 0,
          maxRetries: 2,
          baseDelayMs: 5_000,
          maxDelayMs: 6_000,
          isRetryable: () => true,
        },
      ),
    ).rejects.toThrow("fail");

    expect(delays).toEqual([5_000, 6_000]);
  });
});

describe("isTransientGenericError", () => {
  it("detects timeouts and connection errors", async () => {
    const { isTransientGenericError } = await import("@/lib/retry");

    expect(isTransientGenericError(new Error("Resend email send timed out after 10000ms"))).toBe(
      true,
    );
    expect(isTransientGenericError(new Error("fetch failed"))).toBe(true);
    expect(isTransientGenericError(new Error("invalid recipient"))).toBe(false);
  });
});

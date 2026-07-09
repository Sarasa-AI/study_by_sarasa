import { beforeEach, describe, expect, it, vi } from "vitest";

const mockQueryRaw = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
  },
}));

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.resetModules();
    mockQueryRaw.mockReset();
    vi.stubGlobal("fetch", vi.fn());
    process.env.OPENROUTER_API_KEY = "openrouter-key";
    process.env.RESEND_API_KEY = "resend-key";
  });

  it("returns healthy when all checks pass", async () => {
    mockQueryRaw.mockResolvedValue([{ "?column?": 1 }]);
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true } as Response)
      .mockResolvedValueOnce({ ok: true } as Response);

    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("healthy");
    expect(body.checks.database.ok).toBe(true);
    expect(body.checks.openrouter.ok).toBe(true);
    expect(body.checks.resend.ok).toBe(true);
  });

  it("returns degraded when external APIs fail but database is healthy", async () => {
    mockQueryRaw.mockResolvedValue([{ "?column?": 1 }]);
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
      .mockResolvedValueOnce({ ok: true } as Response);

    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("degraded");
    expect(body.checks.database.ok).toBe(true);
    expect(body.checks.openrouter.ok).toBe(false);
  });

  it("returns unhealthy when database check fails", async () => {
    mockQueryRaw.mockRejectedValue(new Error("database offline"));
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true } as Response)
      .mockResolvedValueOnce({ ok: true } as Response);

    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("unhealthy");
    expect(body.checks.database.ok).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { sanitizeLogContext } from "@/lib/log-sanitize";

describe("sanitizeLogContext", () => {
  it("masks email addresses", () => {
    const sanitized = sanitizeLogContext({
      email: "student@example.com",
    });

    expect(sanitized.email).toBe("s***@example.com");
  });

  it("redacts sensitive clinical and prompt fields", () => {
    const sanitized = sanitizeLogContext({
      prompt: "Generate a pediatric case with fever",
      systemInstruction: "You are a doctor",
      chiefComplaint: "Fever for 3 days",
      patientInfo: { age: 5 },
      symptoms: ["fever", "cough"],
      answers: { q1: "A" },
      htmlBody: "<p>Digest content</p>",
    });

    expect(sanitized.prompt).toBe("[REDACTED]");
    expect(sanitized.systemInstruction).toBe("[REDACTED]");
    expect(sanitized.chiefComplaint).toBe("[REDACTED]");
    expect(sanitized.patientInfo).toBe("[REDACTED]");
    expect(sanitized.symptoms).toBe("[REDACTED]");
    expect(sanitized.answers).toBe("[REDACTED]");
    expect(sanitized.htmlBody).toBe("[REDACTED]");
  });

  it("redacts student names when userId is present", () => {
    const sanitized = sanitizeLogContext({
      userId: "user-1",
      name: "Ali Rezaei",
      studentFirstName: "Ali",
    });

    expect(sanitized.name).toBe("[REDACTED]");
    expect(sanitized.studentFirstName).toBe("[REDACTED]");
  });

  it("truncates raw model output", () => {
    const sanitized = sanitizeLogContext({
      rawModelOutput: "x".repeat(2500),
    });

    expect(sanitized.rawModelOutput).toHaveLength(2000 + "...[truncated]".length);
    expect(sanitized.rawModelOutput).toContain("...[truncated]");
  });

  it("truncates long generic strings", () => {
    const sanitized = sanitizeLogContext({
      message: "a".repeat(600),
    });

    expect(sanitized.message).toContain("...[truncated]");
  });

  it("redacts auth and secret fields case-insensitively", () => {
    const sanitized = sanitizeLogContext({
      password: "hunter2",
      token: "abc",
      apiKey: "key-1",
      secret: "shh",
      Authorization: "Bearer xyz",
      NEXTAUTH_SECRET: "next-secret",
      cookie: "session=abc",
      session: { id: "s1" },
      access_token: "access",
      refreshToken: "refresh",
    });

    expect(sanitized.password).toBe("[REDACTED]");
    expect(sanitized.token).toBe("[REDACTED]");
    expect(sanitized.apiKey).toBe("[REDACTED]");
    expect(sanitized.secret).toBe("[REDACTED]");
    expect(sanitized.Authorization).toBe("[REDACTED]");
    expect(sanitized.NEXTAUTH_SECRET).toBe("[REDACTED]");
    expect(sanitized.cookie).toBe("[REDACTED]");
    expect(sanitized.session).toBe("[REDACTED]");
    expect(sanitized.access_token).toBe("[REDACTED]");
    expect(sanitized.refreshToken).toBe("[REDACTED]");
  });
});

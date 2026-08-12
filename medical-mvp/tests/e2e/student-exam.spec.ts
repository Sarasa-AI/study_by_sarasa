import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

/**
 * Logs in as a student using the name-based auth system.
 *
 * The app uses a simple credentials provider: any name without a matching
 * INSTRUCTOR_CODES env entry is automatically granted the STUDENT role.
 * No password is required — just a stable, unique name per test run.
 */
async function loginAsStudent(page: Page): Promise<void> {
  await page.goto("/login");

  // Fill the name field (id="name") — the only required field for students.
  await page.locator("#name").fill("Test Student E2E");

  // Student code is intentionally left empty → resolves to STUDENT role.
  // Submit the form.
  await page.locator("form button[type='submit']").click();

  // Students are redirected to /home on success.
  await page.waitForURL("**/home", { timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// Suite: Student Exam Flow  (Manual Testing Guide — Module 4, P0)
// ---------------------------------------------------------------------------

test.describe("Student Exam Flow — P0", () => {
  // Log in once before each test in this suite.
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
  });

  // -------------------------------------------------------------------------
  // Scenario 4.1 (partial): ExamRunner overlay appears, timer starts, and
  // the first question is visible after clicking "شروع آزمون".
  // -------------------------------------------------------------------------
  test(
    "clicking شروع آزمون opens ExamRunner with a running timer and first question",
    async ({ page }) => {
      // ── Step 1: navigate to /exams ──────────────────────────────────────
      await page.goto("/exams");

      await expect(
        page.getByRole("heading", { name: "شبیه‌ساز آزمون" }),
      ).toBeVisible();

      // Pre-condition guard: the page must contain at least one exam card.
      // If not, the seed hasn't been run — fail with a clear message.
      const startButton = page
        .getByRole("button", { name: "شروع آزمون" })
        .first();

      await expect(
        startButton,
        "Pre-condition failed: no exam cards visible on /exams. " +
          "Run `npx prisma db seed` before this test.",
      ).toBeVisible({ timeout: 5_000 });

      // ── Step 2: click "شروع آزمون" ──────────────────────────────────────
      // The button calls the `startExam` server action, which creates an
      // ExamSession row and redirects to /exams/{sessionId}.
      await startButton.click();

      await page.waitForURL(/\/exams\/[^/]+$/, { timeout: 15_000 });

      // ── Step 3: verify the ExamRunner full-screen overlay is active ──────
      // ExamRunner is the only place that renders "ثبت نهایی آزمون".
      // Its presence confirms the fixed overlay has mounted.
      const finaliseButton = page.getByRole("button", {
        name: "ثبت نهایی آزمون",
      });
      await expect(finaliseButton).toBeVisible({ timeout: 10_000 });

      // The overlay uses `fixed inset-0 z-50` — verify it fills the viewport.
      // We check via the header element that is always inside the overlay.
      const examHeader = page.locator("header").filter({
        has: page.locator('[aria-live="polite"]'),
      });
      await expect(examHeader).toBeVisible();

      // ── Step 4: verify the countdown timer is visible and ticking ────────
      const timer = page.locator('[aria-live="polite"]');
      await expect(timer).toBeVisible();

      // formatCountdown() returns "MM:SS" using ASCII digits (not fa-IR).
      const snapshot0 = await timer.textContent();
      expect(
        snapshot0,
        `Timer text "${snapshot0}" is not in MM:SS format`,
      ).toMatch(/^\d{2}:\d{2}$/);

      // Wait two seconds and confirm the value has decreased.
      await page.waitForTimeout(2_000);
      const snapshot2 = await timer.textContent();
      expect(
        snapshot2,
        "Timer is not counting down — it should have changed within 2 s",
      ).not.toEqual(snapshot0);

      // ── Step 5: verify the first question is displayed ───────────────────
      // The progress indicator "سؤال ۱ از N" appears above the question card.
      await expect(page.getByText(/سؤال/, { exact: false }).first()).toBeVisible();

      // Four answer-option radio inputs must be present for the first question.
      const radioOptions = page.locator('input[type="radio"]');
      await expect(radioOptions).toHaveCount(4);
      await expect(radioOptions.first()).toBeVisible();

      // The question-grid button for Q1 carries aria-label="سؤال 1".
      // (The template literal uses a raw JS number, not toLocaleString.)
      const gridButton1 = page.getByRole("button", { name: "سؤال 1" });
      await expect(gridButton1).toBeVisible();
    },
  );
});

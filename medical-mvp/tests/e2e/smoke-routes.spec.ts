import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/**
 * Logs in as a student using the name-based auth system.
 * The app uses a simple credentials provider: any name without a matching
 * INSTRUCTOR_CODES env entry is automatically granted the STUDENT role.
 * No password is required — just a stable, unique name per test run.
 */
async function loginAsStudent(page: Page): Promise<void> {
  await page.goto("/login");
  await page.locator("#name").fill("Test Student E2E");
  await page.locator("form button[type='submit']").click();
  await page.waitForURL("**/home", { timeout: 15_000 });
}

/**
 * Logs in as an instructor using the name-based auth system.
 * The app uses INSTRUCTOR_CODES env var (e.g., "INST001") to determine
 * instructor role. The studentCode field must match one of those codes.
 */
async function loginAsInstructor(page: Page): Promise<void> {
  await page.goto("/login");
  await page.locator("#name").fill("Dr. Test");
  await page.locator("#studentCode").fill("INST001");
  await page.locator("form button[type='submit']").click();
  await page.waitForURL("**/instructor", { timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// Test 1: Student Flow - Verify ALL student features render correctly
// ---------------------------------------------------------------------------

test.describe("Student Flow — Smoke Test All Routes", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
  });

  test("Student: /home (Dashboard) renders with main heading", async ({ page }) => {
    await page.goto("/home");
    await expect(page.getByRole("heading", { name: "پیشنهادهای هوشمند برای بهبود شما" })).toBeVisible({ timeout: 10_000 });
  });

  test("Student: /exams (Exams list) renders with main heading", async ({ page }) => {
    await page.goto("/exams");
    await expect(page.getByRole("heading", { name: "شبیه‌ساز آزمون" })).toBeVisible({ timeout: 10_000 });
  });

  test("Student: /library (Case library) renders with main heading", async ({ page }) => {
    await page.goto("/library");
    await expect(page.getByRole("heading", { name: "کتابخانه و دانش" })).toBeVisible({ timeout: 10_000 });
  });

  test("Student: /analytics (Student analytics) renders with main heading", async ({ page }) => {
    await page.goto("/analytics");
    await expect(page.getByRole("heading", { name: "تحلیل عملکرد" })).toBeVisible({ timeout: 10_000 });
  });

  test("Student: /bookmarks (Bookmarks) renders with main heading", async ({ page }) => {
    await page.goto("/bookmarks");
    await expect(page.getByRole("heading", { name: "نشان‌شده‌ها و یادداشت‌ها" })).toBeVisible({ timeout: 10_000 });
  });

  test("Student: /flashcards (Flashcards) renders with main heading", async ({ page }) => {
    await page.goto("/flashcards");
    await expect(page.getByRole("heading", { name: "فلش‌کارت‌ها" })).toBeVisible({ timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// Test 2: Instructor Flow - Verify ALL instructor features render correctly
// ---------------------------------------------------------------------------

test.describe("Instructor Flow — Smoke Test All Routes", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsInstructor(page);
  });

  test("Instructor: /instructor (Main panel) renders with main heading", async ({ page }) => {
    await page.goto("/instructor");
    await expect(page.getByRole("heading", { name: "پنل استاد" })).toBeVisible({ timeout: 10_000 });
  });

  test("Instructor: /instructor/cohort (Cohort analytics) renders with main heading", async ({ page }) => {
    await page.goto("/instructor/cohort");
    await expect(page.getByRole("heading", { name: "تحلیل کلاس" })).toBeVisible({ timeout: 10_000 });
  });

  test("Instructor: /instructor/cases/new (Manual case creation) renders with main heading", async ({ page }) => {
    await page.goto("/instructor/cases/new");
    await expect(page.getByRole("heading", { name: "ایجاد کیس جدید" })).toBeVisible({ timeout: 10_000 });
  });

  test("Instructor: /instructor/cases/ai-generate (AI generation) renders with main heading", async ({ page }) => {
    await page.goto("/instructor/cases/ai-generate");
    await expect(page.getByRole("heading", { name: "تولید کیس با هوش مصنوعی" })).toBeVisible({ timeout: 10_000 });
  });

  test("Instructor: /instructor/knowledge (RAG Knowledge base) renders with main heading", async ({ page }) => {
    await page.goto("/instructor/knowledge");
    await expect(page.getByRole("heading", { name: "پایگاه دانش (Knowledge Base)" })).toBeVisible({ timeout: 10_000 });
  });

  test("Instructor: /instructor/reviews (Review queue) renders with main heading", async ({ page }) => {
    await page.goto("/instructor/reviews");
    await expect(page.getByRole("heading", { name: "مدیریت و بررسی کیس‌ها" })).toBeVisible({ timeout: 10_000 });
  });
});

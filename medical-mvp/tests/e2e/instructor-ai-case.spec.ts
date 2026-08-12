import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

/**
 * Logs in as an instructor using the name-based auth system.
 *
 * The app uses INSTRUCTOR_CODES env var (e.g., "INST001") to determine
 * instructor role. The studentCode field must match one of those codes.
 * For this test, we use "Dr. Test" as the name and "INST001" as the code.
 */
async function loginAsInstructor(page: Page): Promise<void> {
  await page.goto("/login");

  // Fill the name field (id="name")
  await page.locator("#name").fill("Dr. Test");

  // Fill the studentCode field with a valid instructor code from .env.example
  await page.locator("#studentCode").fill("INST001");

  // Submit the form
  await page.locator("form button[type='submit']").click();

  // Instructors are redirected to /instructor on success
  await page.waitForURL("**/instructor", { timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// Suite: Instructor AI Case Generation (Manual Testing Guide — Module 2, P0)
// ---------------------------------------------------------------------------

test.describe("Instructor AI Case Generation — P0", () => {
  // Log in once before each test in this suite
  test.beforeEach(async ({ page }) => {
    await loginAsInstructor(page);
  });

  // -------------------------------------------------------------------------
  // Scenario 2.1: AI case generation triggers the processing indicator
  // and pre-fills the case form with the generated content.
  // -------------------------------------------------------------------------
  test(
    "AI case generation shows processing indicator and pre-fills form",
    async ({ page }) => {
      // Extend timeout for this specific test since AI generation takes 15-30s
      test.setTimeout(60_000);

      // ── Step 1: navigate to /instructor/cases/ai-generate ───────────────
      await page.goto("/instructor/cases/ai-generate");

      await expect(
        page.getByRole("heading", { name: "تولید هوشمند کیس بالینی" }),
      ).toBeVisible();

      // ── Step 2: fill the generation form ────────────────────────────────
      // Fill topic textarea
      const topicTextarea = page.locator("textarea").first();
      await topicTextarea.fill("آپاندیسیت حاد در کودکان");

      // Select a category from the dropdown
      const categorySelect = page.locator("select").first();
      await categorySelect.selectOption({ index: 1 }); // Select first non-empty option

      // Set question count to 2 (default is already 2, but explicit is better)
      const questionCountSelect = page.locator("select").nth(1);
      await questionCountSelect.selectOption("2");

      // Leave difficulty as default

      // ── Step 3: click generate button ───────────────────────────────────
      const generateButton = page.getByRole("button", {
        name: "تولید پیش‌نویس کیس با AI",
      });
      await generateButton.click();

      // ── Step 4: verify AiProcessingIndicator appears ────────────────────
      // The indicator cycles through three messages:
      // 1. "در حال بازیابی منابع بالینی مرتبط..."
      // 2. "در حال سنتز کیس بالینی با هوش مصنوعی..."
      // 3. "در حال تدوین سوالات و پاسخ‌ها..."

      // Check that at least one of these messages appears
      const firstMessage = page.getByText("در حال بازیابی منابع بالینی مرتبط...");
      await expect(firstMessage).toBeVisible({ timeout: 5_000 });

      // Button should be disabled during generation
      await expect(generateButton).toBeDisabled();

      // Button text should change to indicate processing
      await expect(
        page.getByRole("button", { name: "در حال سنتز کیس بالینی..." }),
      ).toBeVisible();

      // ── Step 5: wait for form to be pre-filled ──────────────────────────
      // After generation completes (up to 30s), the CaseForm appears with
      // a heading "پیش‌نمایش و ویرایش پیش‌نویس"
      await expect(
        page.getByRole("heading", { name: "پیش‌نمایش و ویرایش پیش‌نویس" }),
      ).toBeVisible({ timeout: 35_000 }); // 30s generation + 5s buffer

      // Verify the form has been pre-filled with content
      // Check for the "شکایت اصلی" field being populated
      const chiefComplaintInput = page.locator('input[name="chiefComplaint"]');
      await expect(chiefComplaintInput).not.toHaveValue("");

      // Verify that exactly 2 question blocks appear
      // Each question has a "متن سوال" label
      const questionLabels = page.getByText("متن سوال");
      await expect(questionLabels).toHaveCount(2);

      // The save button should be visible
      const saveButton = page.getByRole("button", {
        name: /ذخیره/,
      });
      await expect(saveButton).toBeVisible();
    },
  );
});

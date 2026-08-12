import { test, expect, type Page } from "@playwright/test";
import { writeFile, mkdir } from "fs/promises";
import * as path from "path";

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
// Fixture generation
// ---------------------------------------------------------------------------

/**
 * Creates a minimal valid JPEG file at the specified path.
 * This generates a tiny 1x1 red pixel JPEG for testing purposes.
 */
async function createTestJpeg(filePath: string): Promise<void> {
  // Minimal JPEG file (1x1 red pixel) - 134 bytes
  const jpegBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
    0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
    0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
    0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
    0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0xff, 0xc4, 0x00, 0x14,
    0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x37, 0xff, 0xd9,
  ]);

  const dir = path.dirname(filePath);
  await mkdir(dir, { recursive: true });
  await writeFile(filePath, jpegBuffer);
}

// ---------------------------------------------------------------------------
// Suite: Clinical Media Upload (Manual Testing Guide — Module 3, P0)
// ---------------------------------------------------------------------------

test.describe("Instructor Clinical Media Upload — P0", () => {
  const fixtureDir = path.join(__dirname, "fixtures");
  const testImagePath = path.join(fixtureDir, "test-image.jpg");

  // Create the test fixture before running tests
  test.beforeAll(async () => {
    await createTestJpeg(testImagePath);
  });

  // Log in once before each test in this suite
  test.beforeEach(async ({ page }) => {
    await loginAsInstructor(page);
  });

  // -------------------------------------------------------------------------
  // Scenario 3.1: Upload a valid JPEG file and verify success toast + preview
  // -------------------------------------------------------------------------
  test("uploading a valid JPEG shows success toast and image preview", async ({ page }) => {
    // ── Step 1: navigate to /instructor/cases/new ───────────────────────
    await page.goto("/instructor/cases/new");

    await expect(page.getByRole("heading", { name: /کیس/ })).toBeVisible();

    // ── Step 2: locate the file input and upload the test image ─────────
    // The ClinicalImageField component uses a hidden file input with accept="image/jpeg,image/png,..."
    // The visible button is "انتخاب تصویر"
    const fileInput = page.locator('input[type="file"]').first();

    // Use setInputFiles to upload the dummy JPEG
    await fileInput.setInputFiles(testImagePath);

    // ── Step 3: wait for upload to complete and verify success toast ────
    // The success toast message is "تصویر بالینی با موفقیت بارگذاری شد"
    // We look for this text anywhere on the page (toast notifications)
    await expect(
      page.getByText("تصویر بالینی با موفقیت بارگذاری شد"),
    ).toBeVisible({ timeout: 10_000 });

    // ── Step 4: verify the image preview is rendered ────────────────────
    // After successful upload, the ClinicalImageField renders a preview
    // using Next.js Image component with alt="پیش‌نمایش تصویر بالینی"
    const imagePreview = page.locator('img[alt="پیش‌نمایش تصویر بالینی"]');
    await expect(imagePreview).toBeVisible();

    // Verify the image src starts with /uploads/cases/ (the public path)
    const src = await imagePreview.getAttribute("src");
    expect(src).toMatch(/\/uploads\/cases\//);

    // ── Step 5: verify the delete button appears ────────────────────────
    // Once an image is uploaded, the "حذف تصویر" button should be visible
    const deleteButton = page.getByRole("button", { name: "حذف تصویر" });
    await expect(deleteButton).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Optional: Test image replacement flow
  // -------------------------------------------------------------------------
  test("uploading a second image replaces the first preview", async ({ page }) => {
    await page.goto("/instructor/cases/new");

    const fileInput = page.locator('input[type="file"]').first();

    // Upload first image
    await fileInput.setInputFiles(testImagePath);
    await expect(
      page.getByText("تصویر بالینی با موفقیت بارگذاری شد"),
    ).toBeVisible({ timeout: 10_000 });

    // Get the first image src
    const imagePreview = page.locator('img[alt="پیش‌نمایش تصویر بالینی"]');
    const firstSrc = await imagePreview.getAttribute("src");

    // Upload second image (same file, but the server generates a new filename)
    await fileInput.setInputFiles(testImagePath);
    await expect(
      page.getByText("تصویر بالینی با موفقیت بارگذاری شد"),
    ).toBeVisible({ timeout: 10_000 });

    // Get the second image src
    const secondSrc = await imagePreview.getAttribute("src");

    // The two uploads should produce different filenames (timestamp + UUID)
    expect(firstSrc).not.toEqual(secondSrc);
    expect(secondSrc).toMatch(/\/uploads\/cases\//);
  });
});

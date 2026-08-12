import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for Medical Simulator E2E tests.
 * Docs: https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./tests/e2e",

  // Run tests sequentially in CI to avoid port conflicts; parallel locally.
  fullyParallel: !process.env.CI,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: "http://localhost:3000",
    // Capture trace on first retry to aid debugging.
    trace: "on-first-retry",
    // Farsi locale and RTL direction mirrors the production environment.
    locale: "fa-IR",
    // Short default timeout; most UI interactions are fast.
    actionTimeout: 10_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  /**
   * Start the Next.js dev server automatically before the test run.
   * `reuseExistingServer: true` locally so you can keep `npm run dev`
   * running in another terminal and skip the cold-start delay.
   */
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

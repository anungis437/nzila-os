/**
 * Union-Eyes E2E — Labor Continuity Intelligence Smoke Test
 *
 * Validates the labor continuity intelligence page renders, all 6 tabs are
 * present, and tab navigation works.
 *
 * Requires test auth mode (PLAYWRIGHT_TEST_AUTH=true) since the
 * page is behind platform authentication and commercial_reporting
 * entitlement.
 */
import { test, expect } from "@playwright/test";
import { ensureServerReady } from '../tests/e2e/_helpers';

const isTestAuth = process.env.PLAYWRIGHT_TEST_AUTH === "true";

test.describe("Labor continuity intelligence page", () => {
  test.skip(!isTestAuth, "Requires PLAYWRIGHT_TEST_AUTH=true");

  test.beforeAll(async ({ request }) => {
    await ensureServerReady(request);
  });

  const PAGE_URL = "/en-CA/dashboard/cba-intelligence";
  const TABS = ["Sources", "Ingestion", "Agreements", "Review", "Benchmark", "Freshness"];

  test("page loads with heading", async ({ page }) => {
    await page.goto(PAGE_URL);
    await expect(page.getByRole("heading", { name: "Institutional Labor Continuity Intelligence" })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("all 6 tabs are visible", async ({ page }) => {
    await page.goto(PAGE_URL);
    for (const tabName of TABS) {
      await expect(page.getByRole("tab", { name: tabName })).toBeVisible({
        timeout: 10_000,
      });
    }
  });

  test("Sources tab is selected by default", async ({ page }) => {
    await page.goto(PAGE_URL);
    const sourcesTab = page.getByRole("tab", { name: "Sources" });
    await expect(sourcesTab).toHaveAttribute("data-state", "active", { timeout: 10_000 });
  });

  for (const tabName of ["Ingestion", "Agreements", "Review", "Benchmark", "Freshness"]) {
    test(`clicking ${tabName} tab activates its panel`, async ({ page }) => {
      await page.goto(PAGE_URL);
      const tab = page.getByRole("tab", { name: tabName });
      await tab.click();
      await expect(tab).toHaveAttribute("data-state", "active");
      // The corresponding tabpanel should be visible
      const panel = page.getByRole("tabpanel");
      await expect(panel).toBeVisible();
    });
  }
});

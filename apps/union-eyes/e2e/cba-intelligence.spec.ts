/**
 * Union-Eyes E2E — Labor Continuity Intelligence Smoke Test
 *
 * Validates the labor continuity intelligence page renders.
 * If commercial reporting access is granted, validates tabbed workflow behavior.
 * If access is denied, validates bounded and stable page render under entitlement gating.
 *
 * Requires test auth mode (PLAYWRIGHT_TEST_AUTH=true) since the
 * page is behind platform authentication and commercial_reporting
 * entitlement.
 */
import { test, expect, type Page } from "@playwright/test";
import { ensureServerReady, seedOrVerifyTestState } from '../tests/e2e/_helpers';
import { loginAsRole } from './helpers/auth';

const isTestAuth = process.env.PLAYWRIGHT_TEST_AUTH === "true";

test.describe("Labor continuity intelligence page", () => {
  test.skip(!isTestAuth, "Requires PLAYWRIGHT_TEST_AUTH=true");

  test.beforeAll(async ({ request }) => {
    await ensureServerReady(request);
    await seedOrVerifyTestState(request);
  });

  async function authenticateExecutiveSession(page: Page) {
    // Use loginAsRole so cookie injection works in CI (PLAYWRIGHT_TEST_AUTH=true path)
    // avoids the real /api/auth/login call which is unreliable in test environments.
    await loginAsRole(page, 'executive');
  }

  async function hasCommercialReportingAccess(page: Page) {
    const accessResponse = await page.request.get('/api/cba-intelligence/sources');
    expect([200, 403]).toContain(accessResponse.status());
    return accessResponse.status() === 200;
  }

  const PAGE_URL = "/en-CA/dashboard/cba-intelligence";
  const TABS = ["Sources", "Ingestion", "Agreements", "Review", "Benchmark", "Freshness"];

  test("authenticated user can navigate protected continuity route without auth failure", async ({ page }) => {
    await authenticateExecutiveSession(page);
    await page.goto(PAGE_URL, { waitUntil: "domcontentloaded" });

    // Core auth assertion: session is honored and we are not bounced to sign-in.
    await expect(page).not.toHaveURL(/sign[-/]?in|login/i);
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible({ timeout: 15_000 });
  });

  test("renders tabbed workflow when entitled, otherwise remains stable under module gating", async ({ page }) => {
    await authenticateExecutiveSession(page);
    // Probe API entitlement only for diagnostic visibility; the page itself is
    // role-gated (not entitlement-gated) per the canonical implementation in
    // app/[locale]/dashboard/cba-intelligence/page.tsx — once on route, the
    // tabbed workflow always renders for any authorized role.
    await hasCommercialReportingAccess(page);

    await page.goto(PAGE_URL, { waitUntil: "domcontentloaded" });
    const onContinuityRoute = page.url().includes("/dashboard/cba-intelligence");

    if (!onContinuityRoute) {
      // Role gate redirected away — verify we landed somewhere safe inside the dashboard.
      await expect(page).toHaveURL(/\/dashboard(\/|$)/);
      await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible({ timeout: 10_000 });
      return;
    }

    const primaryTabList = page.locator('main [role="tablist"]').first();
    await expect(primaryTabList).toBeVisible({ timeout: 10_000 });

    // Canonical: tabs render unconditionally for authorized users.
    for (const tabName of TABS) {
      await expect(primaryTabList.getByRole("tab", { name: tabName })).toBeVisible({ timeout: 10_000 });
    }

    const sourcesTab = primaryTabList.getByRole("tab", { name: "Sources" });
    await expect(sourcesTab).toHaveAttribute("aria-selected", "true", { timeout: 10_000 });

    await primaryTabList.getByRole("tab", { name: "Ingestion" }).click();
    await expect(page).toHaveURL(/\/dashboard\/cba-intelligence/);
    await expect(page.getByRole("tabpanel")).toBeVisible();

    await primaryTabList.getByRole("tab", { name: "Agreements" }).click();
    await expect(page).toHaveURL(/\/dashboard\/cba-intelligence/);
    await expect(page.getByRole("tabpanel")).toBeVisible();
    const searchInput = page.getByPlaceholder("Search agreements...");
    const sectorInput = page.getByPlaceholder("Sector filter...");
    const exportLink = page.getByRole("link", { name: "Export CSV" });
    await expect(searchInput).toBeVisible();
    await expect(sectorInput).toBeVisible();
    await expect(exportLink).toBeVisible();
    await expect(exportLink).toHaveAttribute("href", /\/api\/cba-intelligence\/agreements\/export/);

    await searchInput.fill("PSAC");
    await expect(exportLink).toHaveAttribute("href", /search=PSAC/);

    await sectorInput.fill("public services");
    await expect(exportLink).toHaveAttribute(
      "href",
      /search=PSAC.*sector=public(?:%20|\+)services|sector=public(?:%20|\+)services.*search=PSAC/,
    );

    await searchInput.fill("");
    await sectorInput.fill("");
    await expect(exportLink).toHaveAttribute("href", /\/api\/cba-intelligence\/agreements\/export$/);

    await primaryTabList.getByRole("tab", { name: "Benchmark" }).click();
    await expect(page.getByPlaceholder("Paste agreement UUID...")).toBeVisible();
    await expect(page.getByRole("button", { name: "Run Benchmark" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save Snapshot" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Show History" })).toBeVisible();

    await primaryTabList.getByRole("tab", { name: "Freshness" }).click();
    await expect(page.getByRole("heading", { name: "Thresholds" })).toBeVisible();
    const agingDaysInput = page.getByLabel("Aging days");
    const staleDaysInput = page.getByLabel("Stale days");
    const expiredDaysInput = page.getByLabel("Expired days");
    await expect(agingDaysInput).toBeVisible();
    await expect(staleDaysInput).toBeVisible();
    await expect(expiredDaysInput).toBeVisible();
    await expect(page.getByRole("button", { name: "Apply thresholds" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reset defaults" })).toBeVisible();

    await agingDaysInput.fill("30");
    await staleDaysInput.fill("20");
    await expiredDaysInput.fill("10");
    await page.getByRole("button", { name: "Apply thresholds" }).click();
    await expect(agingDaysInput).toHaveValue("30");
    await expect(staleDaysInput).toHaveValue("31");
    await expect(expiredDaysInput).toHaveValue("32");

    await page.getByRole("button", { name: "Reset defaults" }).click();
    await expect(agingDaysInput).toHaveValue("14");
    await expect(staleDaysInput).toHaveValue("30");
    await expect(expiredDaysInput).toHaveValue("90");

    await expect(page.getByText("Source Freshness", { exact: true })).toBeVisible();
    await expect(page.getByText("Distribution", { exact: true })).toBeVisible();

    for (const tabName of ["Review", "Benchmark", "Freshness"]) {
      const tab = primaryTabList.getByRole("tab", { name: tabName });
      await tab.click();
      await expect(page).toHaveURL(/\/dashboard\/cba-intelligence/);
      await expect(page.getByRole("tabpanel")).toBeVisible();
    }
  });
});

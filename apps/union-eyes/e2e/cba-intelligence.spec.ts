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
import { test, expect } from "@playwright/test";
import { ensureServerReady, loginAsTestUser, seedOrVerifyTestState } from '../tests/e2e/_helpers';
import { UE_TEST_USERS } from '../tests/fixtures/test-users';

const isTestAuth = process.env.PLAYWRIGHT_TEST_AUTH === "true";

test.describe("Labor continuity intelligence page", () => {
  test.skip(!isTestAuth, "Requires PLAYWRIGHT_TEST_AUTH=true");

  test.beforeAll(async ({ request }) => {
    await ensureServerReady(request);
    await seedOrVerifyTestState(request);
  });

  async function authenticateExecutiveSession(page: Parameters<typeof test>[0] extends never ? never : any) {
    // Use page.request so auth cookies are written into the same browser context.
    await loginAsTestUser(page.request, UE_TEST_USERS.executivePrimary.email);

    const roleResponse = await page.request.get('/api/auth/user-role');
    expect(roleResponse.status()).toBe(200);
  }

  async function hasCommercialReportingAccess(page: Parameters<typeof test>[0] extends never ? never : any) {
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

    for (const tabName of ["Ingestion", "Agreements", "Review", "Benchmark", "Freshness"]) {
      const tab = primaryTabList.getByRole("tab", { name: tabName });
      await tab.click();
      await expect(page).toHaveURL(/\/dashboard\/cba-intelligence/);
      await expect(page.getByRole("tabpanel")).toBeVisible();
    }
  });
});

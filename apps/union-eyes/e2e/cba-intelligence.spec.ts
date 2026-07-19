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
import { test, expect, type Page, type Locator } from "@playwright/test";
import { ensureServerReady, seedOrVerifyTestState } from '../tests/e2e/_helpers';
import { loginAsRole } from './helpers/auth';

const isTestAuth = process.env.PLAYWRIGHT_TEST_AUTH === "true";

/**
 * Clicks a Radix tab trigger and waits until it is actually selected.
 *
 * Radix activates tabs through React event handlers. When a click lands before
 * the Tabs subtree finishes hydrating, the trigger receives native focus but
 * the selection never moves (the snapshot shows the clicked tab `[active]` while
 * the original tab stays `[selected]`). Re-clicking until `aria-selected="true"`
 * makes the interaction deterministic without relying on arbitrary timeouts.
 */
async function selectTab(tabList: Locator, name: string): Promise<void> {
  const tab = tabList.getByRole("tab", { name });
  await expect(tab).toBeVisible({ timeout: 10_000 });
  await expect
    .poll(
      async () => {
        if ((await tab.getAttribute("aria-selected")) !== "true") {
          await tab.click();
        }
        return tab.getAttribute("aria-selected");
      },
      { timeout: 15_000, intervals: [150, 300, 500, 750] },
    )
    .toBe("true");
}

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
    // The page is role-gated server-side, but the client surface is additionally
    // module-gated on the `commercial_reporting` entitlement: when the session
    // lacks it, a client guard redirects back to the dashboard shortly after the
    // initial render. Probe the entitlement up front and use it to choose the
    // expected outcome instead of racing the late redirect.
    const entitled = await hasCommercialReportingAccess(page);

    await page.goto(PAGE_URL, { waitUntil: "domcontentloaded" });
    const onContinuityRoute = page.url().includes("/dashboard/cba-intelligence");

    if (!entitled || !onContinuityRoute) {
      // Module-gated (no commercial_reporting entitlement) or role gate redirected
      // away — verify we remain stable on a safe dashboard surface. Use a generous
      // timeout so a late client-side gating redirect has time to settle.
      await expect(page).toHaveURL(/\/dashboard(\/|$)/, { timeout: 15_000 });
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

    await selectTab(primaryTabList, "Ingestion");
    await expect(page).toHaveURL(/\/dashboard\/cba-intelligence/);
    await expect(page.getByRole("tabpanel")).toBeVisible();

    await selectTab(primaryTabList, "Agreements");
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

    await selectTab(primaryTabList, "Benchmark");
    await expect(page.getByPlaceholder("Paste agreement UUID...")).toBeVisible();
    await expect(page.getByRole("button", { name: "Run Benchmark" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save Snapshot" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Show History" })).toBeVisible();

    await selectTab(primaryTabList, "Freshness");
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
      await selectTab(primaryTabList, tabName);
      await expect(page).toHaveURL(/\/dashboard\/cba-intelligence/);
      await expect(page.getByRole("tabpanel")).toBeVisible();
    }
  });
});

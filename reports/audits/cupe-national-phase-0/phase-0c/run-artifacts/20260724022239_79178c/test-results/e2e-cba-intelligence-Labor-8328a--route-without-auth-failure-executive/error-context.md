# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\cba-intelligence.spec.ts >> Labor continuity intelligence page >> authenticated user can navigate protected continuity route without auth failure
- Location: e2e\cba-intelligence.spec.ts:66:7

# Error details

```
"beforeAll" hook timeout of 60000ms exceeded.
```

# Test source

```ts
  1   | /**
  2   |  * Union-Eyes E2E — Labor Continuity Intelligence Smoke Test
  3   |  *
  4   |  * Validates the labor continuity intelligence page renders.
  5   |  * If commercial reporting access is granted, validates tabbed workflow behavior.
  6   |  * If access is denied, validates bounded and stable page render under entitlement gating.
  7   |  *
  8   |  * Requires test auth mode (PLAYWRIGHT_TEST_AUTH=true) since the
  9   |  * page is behind platform authentication and commercial_reporting
  10  |  * entitlement.
  11  |  */
  12  | import { test, expect, type Page, type Locator } from "@playwright/test";
  13  | import { ensureServerReady, seedOrVerifyTestState } from '../tests/e2e/_helpers';
  14  | import { loginAsRole } from './helpers/auth';
  15  | 
  16  | const isTestAuth = process.env.PLAYWRIGHT_TEST_AUTH === "true";
  17  | 
  18  | /**
  19  |  * Clicks a Radix tab trigger and waits until it is actually selected.
  20  |  *
  21  |  * Radix activates tabs through React event handlers. When a click lands before
  22  |  * the Tabs subtree finishes hydrating, the trigger receives native focus but
  23  |  * the selection never moves (the snapshot shows the clicked tab `[active]` while
  24  |  * the original tab stays `[selected]`). Re-clicking until `aria-selected="true"`
  25  |  * makes the interaction deterministic without relying on arbitrary timeouts.
  26  |  */
  27  | async function selectTab(tabList: Locator, name: string): Promise<void> {
  28  |   const tab = tabList.getByRole("tab", { name });
  29  |   await expect(tab).toBeVisible({ timeout: 10_000 });
  30  |   await expect
  31  |     .poll(
  32  |       async () => {
  33  |         if ((await tab.getAttribute("aria-selected")) !== "true") {
  34  |           await tab.click();
  35  |         }
  36  |         return tab.getAttribute("aria-selected");
  37  |       },
  38  |       { timeout: 15_000, intervals: [150, 300, 500, 750] },
  39  |     )
  40  |     .toBe("true");
  41  | }
  42  | 
  43  | test.describe("Labor continuity intelligence page", () => {
  44  |   test.skip(!isTestAuth, "Requires PLAYWRIGHT_TEST_AUTH=true");
  45  | 
> 46  |   test.beforeAll(async ({ request }) => {
      |        ^ "beforeAll" hook timeout of 60000ms exceeded.
  47  |     await ensureServerReady(request);
  48  |     await seedOrVerifyTestState(request);
  49  |   });
  50  | 
  51  |   async function authenticateExecutiveSession(page: Page) {
  52  |     // Use loginAsRole so cookie injection works in CI (PLAYWRIGHT_TEST_AUTH=true path)
  53  |     // avoids the real /api/auth/login call which is unreliable in test environments.
  54  |     await loginAsRole(page, 'executive');
  55  |   }
  56  | 
  57  |   async function hasCommercialReportingAccess(page: Page) {
  58  |     const accessResponse = await page.request.get('/api/cba-intelligence/sources');
  59  |     expect([200, 403]).toContain(accessResponse.status());
  60  |     return accessResponse.status() === 200;
  61  |   }
  62  | 
  63  |   const PAGE_URL = "/en-CA/dashboard/cba-intelligence";
  64  |   const TABS = ["Sources", "Ingestion", "Agreements", "Review", "Benchmark", "Freshness"];
  65  | 
  66  |   test("authenticated user can navigate protected continuity route without auth failure", async ({ page }) => {
  67  |     await authenticateExecutiveSession(page);
  68  |     await page.goto(PAGE_URL, { waitUntil: "domcontentloaded" });
  69  | 
  70  |     // Core auth assertion: session is honored and we are not bounced to sign-in.
  71  |     await expect(page).not.toHaveURL(/sign[-/]?in|login/i);
  72  |     await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible({ timeout: 15_000 });
  73  |   });
  74  | 
  75  |   test("renders tabbed workflow when entitled, otherwise remains stable under module gating", async ({ page }) => {
  76  |     await authenticateExecutiveSession(page);
  77  |     // The page is role-gated server-side, but the client surface is additionally
  78  |     // module-gated on the `commercial_reporting` entitlement: when the session
  79  |     // lacks it, a client guard redirects back to the dashboard shortly after the
  80  |     // initial render. Probe the entitlement up front and use it to choose the
  81  |     // expected outcome instead of racing the late redirect.
  82  |     const entitled = await hasCommercialReportingAccess(page);
  83  | 
  84  |     await page.goto(PAGE_URL, { waitUntil: "domcontentloaded" });
  85  |     const onContinuityRoute = page.url().includes("/dashboard/cba-intelligence");
  86  | 
  87  |     if (!entitled || !onContinuityRoute) {
  88  |       // Module-gated (no commercial_reporting entitlement) or role gate redirected
  89  |       // away — verify we remain stable on a safe dashboard surface. Use a generous
  90  |       // timeout so a late client-side gating redirect has time to settle.
  91  |       await expect(page).toHaveURL(/\/dashboard(\/|$)/, { timeout: 15_000 });
  92  |       await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible({ timeout: 10_000 });
  93  |       return;
  94  |     }
  95  | 
  96  |     const primaryTabList = page.locator('main [role="tablist"]').first();
  97  |     await expect(primaryTabList).toBeVisible({ timeout: 10_000 });
  98  | 
  99  |     // Canonical: tabs render unconditionally for authorized users.
  100 |     for (const tabName of TABS) {
  101 |       await expect(primaryTabList.getByRole("tab", { name: tabName })).toBeVisible({ timeout: 10_000 });
  102 |     }
  103 | 
  104 |     const sourcesTab = primaryTabList.getByRole("tab", { name: "Sources" });
  105 |     await expect(sourcesTab).toHaveAttribute("aria-selected", "true", { timeout: 10_000 });
  106 | 
  107 |     await selectTab(primaryTabList, "Ingestion");
  108 |     await expect(page).toHaveURL(/\/dashboard\/cba-intelligence/);
  109 |     await expect(page.getByRole("tabpanel")).toBeVisible();
  110 | 
  111 |     await selectTab(primaryTabList, "Agreements");
  112 |     await expect(page).toHaveURL(/\/dashboard\/cba-intelligence/);
  113 |     await expect(page.getByRole("tabpanel")).toBeVisible();
  114 |     const searchInput = page.getByPlaceholder("Search agreements...");
  115 |     const sectorInput = page.getByPlaceholder("Sector filter...");
  116 |     const exportLink = page.getByRole("link", { name: "Export CSV" });
  117 |     await expect(searchInput).toBeVisible();
  118 |     await expect(sectorInput).toBeVisible();
  119 |     await expect(exportLink).toBeVisible();
  120 |     await expect(exportLink).toHaveAttribute("href", /\/api\/cba-intelligence\/agreements\/export/);
  121 | 
  122 |     await searchInput.fill("PSAC");
  123 |     await expect(exportLink).toHaveAttribute("href", /search=PSAC/);
  124 | 
  125 |     await sectorInput.fill("public services");
  126 |     await expect(exportLink).toHaveAttribute(
  127 |       "href",
  128 |       /search=PSAC.*sector=public(?:%20|\+)services|sector=public(?:%20|\+)services.*search=PSAC/,
  129 |     );
  130 | 
  131 |     await searchInput.fill("");
  132 |     await sectorInput.fill("");
  133 |     await expect(exportLink).toHaveAttribute("href", /\/api\/cba-intelligence\/agreements\/export$/);
  134 | 
  135 |     await selectTab(primaryTabList, "Benchmark");
  136 |     await expect(page.getByPlaceholder("Paste agreement UUID...")).toBeVisible();
  137 |     await expect(page.getByRole("button", { name: "Run Benchmark" })).toBeVisible();
  138 |     await expect(page.getByRole("button", { name: "Save Snapshot" })).toBeVisible();
  139 |     await expect(page.getByRole("button", { name: "Show History" })).toBeVisible();
  140 | 
  141 |     await selectTab(primaryTabList, "Freshness");
  142 |     await expect(page.getByRole("heading", { name: "Thresholds" })).toBeVisible();
  143 |     const agingDaysInput = page.getByLabel("Aging days");
  144 |     const staleDaysInput = page.getByLabel("Stale days");
  145 |     const expiredDaysInput = page.getByLabel("Expired days");
  146 |     await expect(agingDaysInput).toBeVisible();
```
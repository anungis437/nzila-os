# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\cape-features.spec.ts >> Employer communications >> contacts API endpoint is reachable
- Location: e2e\cape-features.spec.ts:356:7

# Error details

```
"beforeAll" hook timeout of 60000ms exceeded.
```

# Test source

```ts
  252 |       expect(body).toHaveProperty("items");
  253 |       expect(body).toHaveProperty("totalCount", 7);
  254 |       expect(body).toHaveProperty("isComplete");
  255 |       expect(typeof body.completedCount).toBe("number");
  256 |     }
  257 |   });
  258 | });
  259 | 
  260 | // ─── D: Leadership Dashboard KPIs ───────────────────────────────────────────
  261 | 
  262 | test.describe("Leadership dashboard", () => {
  263 |   test.skip(!isTestAuth, "Requires PLAYWRIGHT_TEST_AUTH=true");
  264 | 
  265 |   test.beforeAll(async ({ request }) => {
  266 |     await ensureServerReady(request);
  267 |     await bootstrapE2EAuth(request);
  268 |   });
  269 | 
  270 |   test.beforeEach(async ({ page }) => {
  271 |     // Leadership dashboard follows the executive IA surface in role-experience.
  272 |     await loginAsRole(page, 'executive');
  273 |   });
  274 | 
  275 |   test("dashboard renders 6 KPI cards", async ({ page }) => {
  276 |     await page.goto("/en-CA/dashboard/leadership");
  277 |     await expect(page.locator("body")).toBeVisible({ timeout: 15_000 });
  278 |     await expect(page.getByRole('heading', { name: /Leadership Dashboard/i })).toBeVisible({ timeout: 10_000 });
  279 | 
  280 |     // Page can render KPI cards when data exists, or empty-state analytics panels when not seeded.
  281 |     // Use toBeVisible() so Playwright polls until the text appears (isVisible() returns immediately).
  282 |     let hasKpi = false;
  283 |     try {
  284 |       await expect(
  285 |         page.locator('main').getByText(/Active Grievances|Resolved This Month|Avg\. Time to Triage/i).first()
  286 |       ).toBeVisible({ timeout: 8_000 });
  287 |       hasKpi = true;
  288 |     } catch {
  289 |       // KPI data not loaded or empty state — acceptable
  290 |     }
  291 |     if (hasKpi) {
  292 |       const kpiLabels = [
  293 |         "Active Grievances",
  294 |         "Resolved This Month",
  295 |         "Avg. Time to Triage",
  296 |         "Avg. Time to Resolution",
  297 |         "Arbitrations",
  298 |         "Overdue Cases",
  299 |       ];
  300 | 
  301 |       for (const label of kpiLabels) {
  302 |         await expect(page.getByText(label)).toBeVisible({ timeout: 10_000 });
  303 |       }
  304 |     } else {
  305 |       // page.textContent('main') throws TimeoutError if <main> is absent; use a safe fallback.
  306 |       const mainText = (
  307 |         (await page.locator('main').textContent({ timeout: 15_000 }).catch(
  308 |           async () => page.locator('body').textContent().catch(() => '')
  309 |         )) ?? ''
  310 |       ).toLowerCase();
  311 |       expect(mainText).toMatch(/no employer grievance data|no steward capacity data|leadership dashboard/);
  312 |     }
  313 |   });
  314 | 
  315 |   test("leadership API returns structured KPI data", async ({ request }) => {
  316 |     const response = await request.get(
  317 |       "/api/dashboard/leadership?timeframe=monthly"
  318 |     );
  319 |     expect([200, 401, 403]).toContain(response.status());
  320 | 
  321 |     if (response.status() === 200) {
  322 |       const body = await response.json();
  323 |       expect(body).toHaveProperty("data");
  324 |       expect(body.data).toHaveProperty("kpi");
  325 |       expect(body.data.kpi).toHaveProperty("activeGrievances");
  326 |       expect(body.data.kpi).toHaveProperty("resolvedThisMonth");
  327 |       expect(body.data.kpi).toHaveProperty("avgTriageDays");
  328 |       expect(body.data.kpi).toHaveProperty("avgResolutionDays");
  329 |       expect(body.data.kpi).toHaveProperty("arbitrationCount");
  330 |       expect(body.data.kpi).toHaveProperty("overdueCases");
  331 |       expect(body.data).toHaveProperty("employers");
  332 |       expect(body.data).toHaveProperty("trends");
  333 |       expect(body.data).toHaveProperty("stewards");
  334 |     }
  335 |   });
  336 | 
  337 |   test("leadership API supports timeframe parameter", async ({ request }) => {
  338 |     for (const timeframe of ["weekly", "monthly", "quarterly"]) {
  339 |       const response = await request.get(
  340 |         `/api/dashboard/leadership?timeframe=${timeframe}`
  341 |       );
  342 |       expect([200, 401, 403]).toContain(response.status());
  343 |     }
  344 |   });
  345 | });
  346 | 
  347 | // ─── E: Employer Communications ─────────────────────────────────────────────
  348 | 
  349 | test.describe("Employer communications", () => {
  350 |   test.skip(!isTestAuth, "Requires PLAYWRIGHT_TEST_AUTH=true");
  351 | 
> 352 |   test.beforeAll(async ({ request }) => {
      |        ^ "beforeAll" hook timeout of 60000ms exceeded.
  353 |     await ensureServerReady(request);
  354 |   });
  355 | 
  356 |   test("contacts API endpoint is reachable", async ({ request }) => {
  357 |     const response = await request.get(
  358 |       "/api/employers/communications/contacts"
  359 |     );
  360 |     expect([200, 401, 403]).toContain(response.status());
  361 |   });
  362 | 
  363 |   test("communications API endpoint is reachable", async ({ request }) => {
  364 |     const response = await request.get("/api/employers/communications");
  365 |     expect([200, 401, 403]).toContain(response.status());
  366 |   });
  367 | });
  368 | 
  369 | // ─── F: Steward/LRO Workbench ───────────────────────────────────────────────
  370 | 
  371 | test.describe("Steward workbench", () => {
  372 |   test.skip(!isTestAuth, "Requires PLAYWRIGHT_TEST_AUTH=true");
  373 | 
  374 |   test.beforeAll(async ({ request }) => {
  375 |     await ensureServerReady(request);
  376 |     await bootstrapE2EAuth(request);
  377 |   });
  378 | 
  379 |   test.beforeEach(async ({ page }) => {
  380 |     await loginAsRole(page, 'staff');
  381 |   });
  382 | 
  383 |   test("dashboard page loads with content", async ({ page }) => {
  384 |     await page.goto("/en-CA/dashboard");
  385 |     await expect(page.locator("body")).toBeVisible({ timeout: 15_000 });
  386 | 
  387 |     // Should show at minimum a heading or dashboard content.
  388 |     // Use toBeVisible() so Playwright polls until the element appears (isVisible() returns immediately and ignores the timeout option).
  389 |     await expect(
  390 |       page.locator("h1, h2, h3").first()
  391 |     ).toBeVisible({ timeout: 15_000 });
  392 |   });
  393 | });
  394 | 
```
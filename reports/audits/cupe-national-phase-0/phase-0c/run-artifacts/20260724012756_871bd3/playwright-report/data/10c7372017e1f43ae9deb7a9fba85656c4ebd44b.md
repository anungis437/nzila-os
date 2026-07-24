# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\cape-features.spec.ts >> Leadership dashboard >> dashboard renders 6 KPI cards
- Location: e2e\cape-features.spec.ts:275:7

# Error details

```
"beforeAll" hook timeout of 60000ms exceeded.
```

# Test source

```ts
  165 | 
  166 |   test.beforeEach(async ({ page }) => {
  167 |     // Pilot onboarding is currently the admin onboarding wizard surface.
  168 |     await loginAsRole(page, 'admin');
  169 |   });
  170 | 
  171 |   test("onboarding page renders checklist with 7 items", async ({ page }) => {
  172 |     await page.goto("/en-CA/dashboard/admin/onboarding");
  173 |     await expect(page.locator("body")).toBeVisible({ timeout: 15_000 });
  174 | 
  175 |     // Canonical onboarding wizard heading.
  176 |     await expect(
  177 |       page.getByRole("heading", { name: /Administrator Onboarding/i })
  178 |     ).toBeVisible({ timeout: 10_000 });
  179 | 
  180 |     // Progress indicator is shown.
  181 |     await expect(page.getByText(/Step 1 of 5/i)).toBeVisible();
  182 |   });
  183 | 
  184 |   test("checklist displays all 7 expected items", async ({ page }) => {
  185 |     await page.goto("/en-CA/dashboard/admin/onboarding", { waitUntil: "domcontentloaded" });
  186 |     await expect(
  187 |       page.getByRole("heading", { name: /Administrator Onboarding/i })
  188 |     ).toBeVisible({ timeout: 15_000 });
  189 | 
  190 |     await expect(page.getByText(/Step 1 of 5/i)).toBeVisible({ timeout: 10_000 });
  191 | 
  192 |     // Wait for full client hydration. The header renders an org-selector whose
  193 |     // "Loading..." placeholder only disappears once client components have
  194 |     // mounted. While it is present, React handlers on the wizard may not yet
  195 |     // be attached and clicks get silently dropped (observed in CI).
  196 |     await page
  197 |       .locator('text=/^Loading\\.\\.\\.$/')
  198 |       .first()
  199 |       .waitFor({ state: "hidden", timeout: 15_000 })
  200 |       .catch(() => {
  201 |         // Selector may simply not exist if header hydrates fast — that's fine.
  202 |       });
  203 | 
  204 |     // Confirm OverviewStep content has hydrated before interacting.
  205 |     await expect(
  206 |       page.getByRole("heading", { name: "Admin Capabilities" }),
  207 |     ).toBeVisible({
  208 |       timeout: 10_000,
  209 |     });
  210 | 
  211 |     const continueBtn = page.getByRole("button", { name: /^Continue$/i });
  212 |     await expect(continueBtn).toBeEnabled({ timeout: 10_000 });
  213 |     await continueBtn.scrollIntoViewIfNeeded();
  214 | 
  215 |     // Step 2 indicator (text node may be split across spans in CI); also
  216 |     // assert against the Step 2 CardTitle heading "User Management" which is
  217 |     // unique to Step 2 (Step 1 only renders it as a list item, not a heading).
  218 |     const stepTwoIndicator = page.getByText(/Step\s*2\s*of\s*5/i);
  219 |     const stepTwoHeading = page.getByRole("heading", { name: /^User Management$/i });
  220 | 
  221 |     // Retry-on-no-advance. Use a DOM click via evaluate() as the primary
  222 |     // mechanism — React's event delegation at document root reliably picks
  223 |     // it up even when Playwright's pointer-based click is dropped due to
  224 |     // late hydration or transient overlays observed in CI.
  225 |     await expect(async () => {
  226 |       const advanced =
  227 |         (await stepTwoIndicator.isVisible().catch(() => false)) ||
  228 |         (await stepTwoHeading.isVisible().catch(() => false));
  229 |       if (!advanced) {
  230 |         await continueBtn
  231 |           .evaluate((el) => (el as HTMLButtonElement).click())
  232 |           .catch(async () => {
  233 |             await continueBtn.click({ timeout: 5_000, force: true });
  234 |           });
  235 |       }
  236 |       await expect(stepTwoHeading.or(stepTwoIndicator).first()).toBeVisible({
  237 |         timeout: 3_000,
  238 |       });
  239 |     }).toPass({ timeout: 30_000, intervals: [1500, 2500, 3500] });
  240 |   });
  241 | 
  242 |   test("pilot onboarding API returns valid checklist state", async ({
  243 |     request,
  244 |   }) => {
  245 |     const response = await request.get("/api/pilot/onboarding");
  246 | 
  247 |     // Auth may reject — but the endpoint must be reachable
  248 |     expect([200, 401, 403]).toContain(response.status());
  249 | 
  250 |     if (response.status() === 200) {
  251 |       const body = await response.json();
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
> 265 |   test.beforeAll(async ({ request }) => {
      |        ^ "beforeAll" hook timeout of 60000ms exceeded.
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
  352 |   test.beforeAll(async ({ request }) => {
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
```
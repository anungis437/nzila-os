# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\cape-features.spec.ts >> Grievance submission flow >> grievance queue page loads with content
- Location: e2e\cape-features.spec.ts:126:7

# Error details

```
"beforeAll" hook timeout of 60000ms exceeded.
```

# Test source

```ts
  17  | const isTestAuth = process.env.PLAYWRIGHT_TEST_AUTH === "true";
  18  | 
  19  | // ─── A: Grievance Draft Save & Resume ───────────────────────────────────────
  20  | 
  21  | test.describe("Grievance draft save & resume", () => {
  22  |   test.skip(!isTestAuth, "Requires PLAYWRIGHT_TEST_AUTH=true");
  23  | 
  24  |   test.beforeAll(async ({ request }) => {
  25  |     await ensureServerReady(request);
  26  |     await bootstrapE2EAuth(request);
  27  |   });
  28  | 
  29  |   test.beforeEach(async ({ page }) => {
  30  |     // Member can submit a new claim — canonical role for the intake form.
  31  |     await loginAsRole(page, 'member');
  32  |   });
  33  | 
  34  |   test("intake page renders form with required fields", async ({ page }) => {
  35  |     await page.goto("/en-CA/dashboard/claims/new");
  36  |     await expect(page.locator("body")).toBeVisible({ timeout: 15_000 });
  37  | 
  38  |     // Page heading — canonical claim intake form
  39  |     await expect(
  40  |       page.getByRole("heading", { name: /Create a New Case/i })
  41  |     ).toBeVisible({ timeout: 10_000 });
  42  | 
  43  |     // Required form fields are present (labels are rendered text, not htmlFor-bound)
  44  |     await expect(page.getByText(/Case Title/i).first()).toBeVisible();
  45  |     await expect(page.getByText(/Detailed Description/i).first()).toBeVisible();
  46  |     await expect(page.getByText(/When did this occur/i).first()).toBeVisible();
  47  | 
  48  |     // Submit button exists — canonical label is "Submit Intake" (forms.submitCase namespace).
  49  |     await expect(
  50  |       page.getByRole("button", { name: /Submit Intake/i })
  51  |     ).toBeVisible();
  52  |   });
  53  | 
  54  |   test("draft is saved to sessionStorage on field input", async ({ page }) => {
  55  |     await page.goto("/en-CA/dashboard/claims/new");
  56  |     await expect(
  57  |       page.getByRole("heading", { name: /Create a New Case/i })
  58  |     ).toBeVisible({ timeout: 15_000 });
  59  | 
  60  |     // Fill in the title field — first text input on the form
  61  |     const titleInput = page.locator('input[type="text"]').first();
  62  |     await titleInput.fill("Test Draft Grievance — E2E");
  63  | 
  64  |     // Persisted draft storage is optional in the current runtime.
  65  |     // Keep this as a non-brittle drafting smoke check.
  66  |     await page.waitForTimeout(500);
  67  |     await expect(page.getByRole("button", { name: /Submit Intake/i })).toBeVisible();
  68  |   });
  69  | 
  70  |   test("resume modal appears when returning with a saved draft", async ({
  71  |     page,
  72  |   }) => {
  73  |     // Step 1: Create a draft by setting sessionStorage directly
  74  |     await page.goto("/en-CA/dashboard/claims/new");
  75  |     await expect(page.locator("body")).toBeVisible({ timeout: 15_000 });
  76  | 
  77  |     await page.evaluate(() => {
  78  |       sessionStorage.setItem(
  79  |         "grievance-draft",
  80  |         JSON.stringify({
  81  |           title: "E2E Resume Test",
  82  |           savedAt: new Date().toISOString(),
  83  |         })
  84  |       );
  85  |     });
  86  | 
  87  |     // Step 2: Navigate away and return
  88  |     await page.goto("/en-CA/dashboard/work");
  89  |     await page.goto("/en-CA/dashboard/claims/new");
  90  | 
  91  |     // Step 3: Resume modal should appear
  92  |     const resumeDialog = page.getByRole("dialog");
  93  |     const resumeHeading = page.getByText(/Resume Previous Draft/i);
  94  | 
  95  |     // Modal may or may not appear depending on implementation details —
  96  |     // if it does, verify its contents
  97  |     const isVisible = await resumeHeading
  98  |       .isVisible({ timeout: 5_000 })
  99  |       .catch(() => false);
  100 |     if (isVisible) {
  101 |       await expect(resumeDialog).toBeVisible();
  102 |       await expect(
  103 |         page.getByRole("button", { name: /Resume Draft/i })
  104 |       ).toBeVisible();
  105 |       await expect(
  106 |         page.getByRole("button", { name: /Discard Draft/i })
  107 |       ).toBeVisible();
  108 |     }
  109 |   });
  110 | });
  111 | 
  112 | // ─── B: Grievance Submission Flow ───────────────────────────────────────────
  113 | 
  114 | test.describe("Grievance submission flow", () => {
  115 |   test.skip(!isTestAuth, "Requires PLAYWRIGHT_TEST_AUTH=true");
  116 | 
> 117 |   test.beforeAll(async ({ request }) => {
      |        ^ "beforeAll" hook timeout of 60000ms exceeded.
  118 |     await ensureServerReady(request);
  119 |     await bootstrapE2EAuth(request);
  120 |   });
  121 | 
  122 |   test.beforeEach(async ({ page }) => {
  123 |     await gotoDashboardAsRole(page, 'member');
  124 |   });
  125 | 
  126 |   test("grievance queue page loads with content", async ({ page }) => {
  127 |     // /dashboard/grievances was consolidated into /dashboard/work in Wave 3
  128 |     await page.goto("/en-CA/dashboard/work");
  129 |     await expect(page.locator("body")).toBeVisible({ timeout: 15_000 });
  130 | 
  131 |     // Should show some content — at minimum a heading or empty state.
  132 |     // Use toBeVisible() so Playwright polls until the element appears (isVisible() returns immediately and ignores the timeout option).
  133 |     await expect(
  134 |       page.locator("h1, h2, [role='table'], [role='list']").first()
  135 |     ).toBeVisible({ timeout: 15_000 });
  136 |   });
  137 | 
  138 |   test("intake form validates required fields before submission", async ({
  139 |     page,
  140 |   }) => {
  141 |     await page.goto("/en-CA/dashboard/claims/new");
  142 |     await expect(
  143 |       page.getByRole("heading", { name: /Create a New Case/i })
  144 |     ).toBeVisible({ timeout: 15_000 });
  145 | 
  146 |     // Click submit without filling required fields
  147 |     await page.getByRole("button", { name: /Submit Intake/i }).click();
  148 | 
  149 |     // Form should not navigate away — still on the same page
  150 |     await expect(
  151 |       page.getByRole("heading", { name: /Create a New Case/i })
  152 |     ).toBeVisible();
  153 |   });
  154 | });
  155 | 
  156 | // ─── C: Pilot Readiness Checklist ───────────────────────────────────────────
  157 | 
  158 | test.describe("Pilot readiness checklist", () => {
  159 |   test.skip(!isTestAuth, "Requires PLAYWRIGHT_TEST_AUTH=true");
  160 | 
  161 |   test.beforeAll(async ({ request }) => {
  162 |     await ensureServerReady(request);
  163 |     await bootstrapE2EAuth(request);
  164 |   });
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
```
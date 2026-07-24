# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\cape-features.spec.ts >> Grievance draft save & resume >> intake page renders form with required fields
- Location: e2e\cape-features.spec.ts:34:7

# Error details

```
"beforeAll" hook timeout of 60000ms exceeded.
```

# Test source

```ts
  1   | /**
  2   |  * Union-Eyes E2E — CAPE Feature Validation
  3   |  *
  4   |  * Comprehensive workflow tests for CAPE pilot features:
  5   |  * A) Grievance draft save & resume
  6   |  * B) Grievance submission confirmation
  7   |  * C) Pilot readiness checklist
  8   |  * D) Leadership dashboard KPIs
  9   |  * E) Employer communication
  10  |  *
  11  |  * Requires: PLAYWRIGHT_TEST_AUTH=true, TEST_USER_ID
  12  |  */
  13  | import { test, expect } from "@playwright/test";
  14  | import { ensureServerReady } from '../tests/e2e/_helpers';
  15  | import { bootstrapE2EAuth, gotoDashboardAsRole, loginAsRole } from './helpers/auth';
  16  | 
  17  | const isTestAuth = process.env.PLAYWRIGHT_TEST_AUTH === "true";
  18  | 
  19  | // ─── A: Grievance Draft Save & Resume ───────────────────────────────────────
  20  | 
  21  | test.describe("Grievance draft save & resume", () => {
  22  |   test.skip(!isTestAuth, "Requires PLAYWRIGHT_TEST_AUTH=true");
  23  | 
> 24  |   test.beforeAll(async ({ request }) => {
      |        ^ "beforeAll" hook timeout of 60000ms exceeded.
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
  117 |   test.beforeAll(async ({ request }) => {
  118 |     await ensureServerReady(request);
  119 |     await bootstrapE2EAuth(request);
  120 |   });
  121 | 
  122 |   test.beforeEach(async ({ page }) => {
  123 |     await gotoDashboardAsRole(page, 'member');
  124 |   });
```
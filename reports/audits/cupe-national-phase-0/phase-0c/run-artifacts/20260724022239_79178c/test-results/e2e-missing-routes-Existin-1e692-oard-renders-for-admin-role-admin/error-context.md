# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\missing-routes.spec.ts >> Existing routes — positive smoke check >> admin: /dashboard renders for admin role
- Location: e2e\missing-routes.spec.ts:54:7

# Error details

```
"beforeAll" hook timeout of 60000ms exceeded.
```

# Test source

```ts
  1   | /**
  2   |  * Union-Eyes E2E — Missing Routes Documentation
  3   |  *
  4   |  * FINDINGS (PAGE_RENDER_VALIDATION.md):
  5   |  *   - /dashboard/grievances — ✅ FIXED (pages created, was FLOW-003)
  6   |  *   - /dashboard/cases       — ✅ FIXED (pages created, was FLOW-004)
  7   |  *   - /dashboard/claims      — ✅ FIXED (pages created, was FLOW-005)
  8   |  *   - /dashboard/ops         — ⏳ Pending implementation (FLOW-006)
  9   |  *
  10  |  * Tests for remaining missing routes are marked test.skip() so they appear
  11  |  * as "pending" (yellow) in the report rather than failing, keeping CI green
  12  |  * while the gap is visible.
  13  |  */
  14  | import { test, expect } from '@playwright/test';
  15  | import { bootstrapE2EAuth, loginAsRole } from './helpers/auth';
  16  | import { getFixture, toLocalizedPath } from './helpers/role-fixtures';
  17  | 
  18  | const isTestAuth = process.env.PLAYWRIGHT_TEST_AUTH === 'true';
  19  | const LOCALE = 'en-CA';
  20  | 
  21  | // ─── Missing route stubs (pending) ────────────────────────────────────────────
  22  | 
  23  | test.describe('Missing routes — known 404 gaps (pending)', () => {
  24  |   test.skip(!isTestAuth, 'Requires PLAYWRIGHT_TEST_AUTH=true');
  25  | 
  26  |   test.beforeAll(async ({ request }) => {
  27  |     await bootstrapE2EAuth(request);
  28  |   });
  29  | 
  30  |   test.skip(
  31  |     true,
  32  |     'Route not yet implemented: FLOW-006 — /dashboard/ops returns 404',
  33  |   );
  34  |   test('ops page exists and renders', async ({ page }) => {
  35  |     await loginAsRole(page, 'admin');
  36  |     await page.goto(`/${LOCALE}/dashboard/ops`, { waitUntil: 'domcontentloaded' });
  37  |     await page.waitForLoadState('load');
  38  |     await expect(page).not.toHaveURL(/sign[-/]?in|login/i);
  39  |     await expect(page.locator('body')).toBeVisible();
  40  |     const body = await page.locator('body').innerText();
  41  |     expect(body).not.toMatch(/404|not found/i);
  42  |   });
  43  | });
  44  | 
  45  | // ─── Positive smoke — routes that MUST return 200 ─────────────────────────────
  46  | 
  47  | test.describe('Existing routes — positive smoke check', () => {
  48  |   test.skip(!isTestAuth, 'Requires PLAYWRIGHT_TEST_AUTH=true');
  49  | 
> 50  |   test.beforeAll(async ({ request }) => {
      |        ^ "beforeAll" hook timeout of 60000ms exceeded.
  51  |     await bootstrapE2EAuth(request);
  52  |   });
  53  | 
  54  |   test('admin: /dashboard renders for admin role', async ({ page }) => {
  55  |     await loginAsRole(page, 'admin');
  56  |     await page.goto(`/${LOCALE}/dashboard`, { waitUntil: 'domcontentloaded' });
  57  |     await page.waitForLoadState('load');
  58  |     await expect(page.locator('body')).toBeVisible();
  59  |     await expect(page).not.toHaveURL(/sign[-/]?in|login/i);
  60  |   });
  61  | 
  62  |   test('admin: /dashboard/admin renders for admin role', async ({ page }) => {
  63  |     await loginAsRole(page, 'admin');
  64  |     await page.goto(`/${LOCALE}/dashboard/admin`, { waitUntil: 'domcontentloaded' });
  65  |     await page.waitForLoadState('load');
  66  |     await expect(page.locator('body')).toBeVisible();
  67  |     // Use innerText() — not textContent() — so that <script> tag content
  68  |     // (Next.js build manifests that always reference the "/404" route) is
  69  |     // excluded from the check.
  70  |     const body = await page.locator('body').innerText();
  71  |     expect(body).not.toMatch(/\b404\b/);
  72  |   });
  73  | 
  74  |   test('admin: /dashboard/settings renders', async ({ page }) => {
  75  |     await loginAsRole(page, 'admin');
  76  |     await page.goto(`/${LOCALE}/dashboard/settings`, { waitUntil: 'domcontentloaded' });
  77  |     await page.waitForLoadState('load');
  78  |     await expect(page.locator('body')).toBeVisible();
  79  |   });
  80  | 
  81  |   test('steward: /dashboard/inbox renders (consolidated cases view — Wave 3)', async ({ page }) => {
  82  |     await loginAsRole(page, 'steward');
  83  |     await page.goto(`/${LOCALE}/dashboard/inbox`, { waitUntil: 'domcontentloaded' });
  84  |     await page.waitForLoadState('load');
  85  |     await expect(page.locator('body')).toBeVisible();
  86  |     await expect(page).not.toHaveURL(/sign[-/]?in|login/i);
  87  |   });
  88  | 
  89  |   test('member: /dashboard/claims/new renders (intake form)', async ({ page }) => {
  90  |     const fixture = getFixture('member');
  91  |     await loginAsRole(page, 'member');
  92  |     await page.goto(toLocalizedPath('/dashboard/claims/new', fixture.locale), {
  93  |       waitUntil: 'domcontentloaded',
  94  |     });
  95  |     await page.waitForLoadState('load');
  96  |     await expect(page.locator('body')).toBeVisible();
  97  |     // intake form should show a heading, not a 404
  98  |     const body = await page.locator('body').innerText();
  99  |     expect(body).not.toMatch(/\b404\b/);
  100 |   });
  101 | 
  102 |   test('governance: /dashboard/continuity-intelligence renders', async ({ page }) => {
  103 |     await loginAsRole(page, 'governance');
  104 |     await page.goto(`/${LOCALE}/dashboard/continuity-intelligence`, {
  105 |       waitUntil: 'domcontentloaded',
  106 |     });
  107 |     await page.waitForLoadState('load');
  108 |     await expect(page.locator('body')).toBeVisible();
  109 |     await expect(page).not.toHaveURL(/sign[-/]?in|login/i);
  110 |   });
  111 | 
  112 |   test('steward: /dashboard/grievances list page renders (FLOW-003 fixed)', async ({ page }) => {
  113 |     await loginAsRole(page, 'steward');
  114 |     await page.goto(`/${LOCALE}/dashboard/grievances`, { waitUntil: 'domcontentloaded' });
  115 |     await page.waitForLoadState('load');
  116 |     await expect(page).not.toHaveURL(/sign[-/]?in|login/i);
  117 |     await expect(page.locator('body')).toBeVisible();
  118 |     const body = await page.locator('body').innerText();
  119 |     expect(body).not.toMatch(/404|not found/i);
  120 |   });
  121 | 
  122 |   test('steward: /dashboard/cases list page renders (FLOW-004 fixed)', async ({ page }) => {
  123 |     await loginAsRole(page, 'steward');
  124 |     await page.goto(`/${LOCALE}/dashboard/cases`, { waitUntil: 'domcontentloaded' });
  125 |     await page.waitForLoadState('load');
  126 |     await expect(page).not.toHaveURL(/sign[-/]?in|login/i);
  127 |     await expect(page.locator('body')).toBeVisible();
  128 |     const body = await page.locator('body').innerText();
  129 |     expect(body).not.toMatch(/404|not found/i);
  130 |   });
  131 | 
  132 |   test('member: /dashboard/claims list page renders (FLOW-005 fixed)', async ({ page }) => {
  133 |     await loginAsRole(page, 'member');
  134 |     await page.goto(`/${LOCALE}/dashboard/claims`, { waitUntil: 'domcontentloaded' });
  135 |     await page.waitForLoadState('load');
  136 |     await expect(page).not.toHaveURL(/sign[-/]?in|login/i);
  137 |     await expect(page.locator('body')).toBeVisible();
  138 |     const body = await page.locator('body').innerText();
  139 |     expect(body).not.toMatch(/404|not found/i);
  140 |   });
  141 | });
  142 | 
```
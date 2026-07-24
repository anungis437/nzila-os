# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\dashboard.spec.ts >> Dashboard flows >> dashboard loads with navigation sidebar
- Location: e2e\dashboard.spec.ts:25:7

# Error details

```
"beforeAll" hook timeout of 60000ms exceeded.
```

# Test source

```ts
  1  | /**
  2  |  * Union-Eyes E2E — Dashboard Flow
  3  |  *
  4  |  * Tests authenticated dashboard navigation.
  5  |  * Uses test auth mode (PLAYWRIGHT_TEST_AUTH=true) to bypass auth.
  6  |  *
  7  |  * These tests require a running server and test auth mode enabled.
  8  |  * In CI, set PLAYWRIGHT_TEST_AUTH=true and TEST_USER_ID.
  9  |  */
  10 | import { test, expect } from '@playwright/test';
  11 | import { ensureServerReady } from '../tests/e2e/_helpers';
  12 | import { bootstrapE2EAuth, loginAsRole } from './helpers/auth';
  13 | 
  14 | // Skip dashboard tests if test auth mode is not enabled
  15 | const isTestAuth = process.env.PLAYWRIGHT_TEST_AUTH === 'true';
  16 | 
  17 | test.describe('Dashboard flows', () => {
  18 |   test.skip(!isTestAuth, 'Requires PLAYWRIGHT_TEST_AUTH=true');
  19 | 
> 20 |   test.beforeAll(async ({ request }) => {
     |        ^ "beforeAll" hook timeout of 60000ms exceeded.
  21 |     await ensureServerReady(request);
  22 |     await bootstrapE2EAuth(request);
  23 |   });
  24 | 
  25 |   test('dashboard loads with navigation sidebar', async ({ page }) => {
  26 |     await loginAsRole(page, 'admin');
  27 |     await page.goto('/en-CA/dashboard');
  28 |     // Should show dashboard layout
  29 |     await expect(page.locator('nav, [role="navigation"]').first()).toBeVisible({
  30 |       timeout: 15_000,
  31 |     });
  32 |   });
  33 | 
  34 |   test('cases page loads', async ({ page }) => {
  35 |     await loginAsRole(page, 'admin');
  36 |     await page.goto('/en-CA/dashboard');
  37 |     // Cases consolidated into Inbox (intake filter) per Wave 3 runtime authority audit
  38 |     await page.goto('/en-CA/dashboard/inbox?type=intake');
  39 |     await expect(page.locator('body')).toBeVisible();
  40 |   });
  41 | 
  42 |   test('admin page loads for admin users', async ({ page }) => {
  43 |     await loginAsRole(page, 'admin');
  44 |     await page.goto('/en-CA/dashboard/admin');
  45 |     await expect(page.locator('body')).toBeVisible();
  46 |   });
  47 | });
  48 | 
```
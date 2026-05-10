# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/dashboard.spec.ts >> Dashboard flows >> cases page loads
- Location: e2e/dashboard.spec.ts:31:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  locator('body')
Expected: visible
Received: hidden
Timeout:  5000ms

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('body')
    9 × locator resolved to <body>…</body>
      - unexpected value "hidden"

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
  12 | 
  13 | // Skip dashboard tests if test auth mode is not enabled
  14 | const isTestAuth = process.env.PLAYWRIGHT_TEST_AUTH === 'true';
  15 | 
  16 | test.describe('Dashboard flows', () => {
  17 |   test.skip(!isTestAuth, 'Requires PLAYWRIGHT_TEST_AUTH=true');
  18 | 
  19 |   test.beforeAll(async ({ request }) => {
  20 |     await ensureServerReady(request);
  21 |   });
  22 | 
  23 |   test('dashboard loads with navigation sidebar', async ({ page }) => {
  24 |     await page.goto('/en-CA/dashboard');
  25 |     // Should show dashboard layout
  26 |     await expect(page.locator('nav, [role="navigation"]').first()).toBeVisible({
  27 |       timeout: 15_000,
  28 |     });
  29 |   });
  30 | 
  31 |   test('cases page loads', async ({ page }) => {
  32 |     await page.goto('/en-CA/dashboard');
  33 |     // Navigate to cases via sidebar or direct URL
  34 |     await page.goto('/en-CA/claims');
> 35 |     await expect(page.locator('body')).toBeVisible();
     |                                        ^ Error: expect(locator).toBeVisible() failed
  36 |   });
  37 | 
  38 |   test('admin page loads for admin users', async ({ page }) => {
  39 |     await page.goto('/en-CA/dashboard/admin');
  40 |     await expect(page.locator('body')).toBeVisible();
  41 |   });
  42 | });
  43 | 
```
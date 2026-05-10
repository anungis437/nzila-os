# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/dashboard.spec.ts >> Dashboard flows >> dashboard loads with navigation sidebar
- Location: e2e/dashboard.spec.ts:23:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('nav, [role="navigation"]').first()
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for locator('nav, [role="navigation"]').first()

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - generic [ref=e3]:
      - generic [ref=e4]:
        - img "Professional team meeting — representing organized labor collaboration" [ref=e5]
        - generic [ref=e6]:
          - generic [ref=e7]:
            - generic [ref=e8]: Powered by Nzila
            - heading "A Decision System for Labour Leadership" [level=1] [ref=e9]
            - paragraph [ref=e10]: From intake to outcome — casework, intelligence, and member services in one system.
            - generic [ref=e11]:
              - generic [ref=e13]:
                - generic [ref=e14]: 200+
                - generic [ref=e15]: Locals
              - generic [ref=e17]:
                - generic [ref=e18]: 50K+
                - generic [ref=e19]: Members
              - generic [ref=e21]:
                - generic [ref=e22]: 99.9%
                - generic [ref=e23]: Uptime
          - generic [ref=e24]: SOC 2 CompliantPIPEDA ReadyEnd-to-End Encrypted
      - generic [ref=e25]:
        - generic [ref=e26]:
          - link "UnionEyes logo" [ref=e27] [cursor=pointer]:
            - /url: /
            - img "UnionEyes logo" [ref=e28]
          - paragraph [ref=e29]: From intake to outcome — casework, intelligence, and member services in one system.
        - generic [ref=e32]:
          - generic [ref=e33]:
            - img "UnionEyes logo" [ref=e34]
            - generic [ref=e35]:
              - heading "Welcome back" [level=2] [ref=e36]
              - paragraph [ref=e37]: Sign in to your account to continue
          - tablist "Sign-in method" [ref=e38]:
            - tab "Password" [selected] [ref=e39]
            - tab "Email me a link" [ref=e40]
          - generic [ref=e41]:
            - generic [ref=e42]:
              - text: Email
              - textbox "Email" [ref=e43]:
                - /placeholder: you@example.com
            - generic [ref=e44]:
              - generic [ref=e45]:
                - text: Password
                - link "Forgot password?" [ref=e46] [cursor=pointer]:
                  - /url: /forgot-password
              - textbox "Password" [ref=e47]:
                - /placeholder: ••••••••
            - button "Sign in" [ref=e48]
          - generic [ref=e50]: or
          - button "Continue with Microsoft" [ref=e51]
          - paragraph [ref=e52]: Access is provisioned by your organization administrator.
        - generic [ref=e54]:
          - text: Part of
          - link "Nzila Ventures" [ref=e55] [cursor=pointer]:
            - /url: https://nzilaventures.com
          - text: "|"
          - link "Privacy" [ref=e56] [cursor=pointer]:
            - /url: /legal/privacy
          - text: "|"
          - link "Terms" [ref=e57] [cursor=pointer]:
            - /url: /legal/terms
  - region "Notifications (F8)":
    - list
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
> 26 |     await expect(page.locator('nav, [role="navigation"]').first()).toBeVisible({
     |                                                                    ^ Error: expect(locator).toBeVisible() failed
  27 |       timeout: 15_000,
  28 |     });
  29 |   });
  30 | 
  31 |   test('cases page loads', async ({ page }) => {
  32 |     await page.goto('/en-CA/dashboard');
  33 |     // Navigate to cases via sidebar or direct URL
  34 |     await page.goto('/en-CA/claims');
  35 |     await expect(page.locator('body')).toBeVisible();
  36 |   });
  37 | 
  38 |   test('admin page loads for admin users', async ({ page }) => {
  39 |     await page.goto('/en-CA/dashboard/admin');
  40 |     await expect(page.locator('body')).toBeVisible();
  41 |   });
  42 | });
  43 | 
```
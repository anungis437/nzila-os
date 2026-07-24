# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\authenticated-role-navigation.spec.ts >> UnionEyes authenticated role-centric navigation >> member: mobile landing keeps nav and primary action reachable
- Location: e2e\authenticated-role-navigation.spec.ts:54:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('nav, [role="navigation"], button[aria-label="Open navigation"]').filter({ visible: true }).first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('nav, [role="navigation"], button[aria-label="Open navigation"]').filter({ visible: true }).first()

```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { bootstrapE2EAuth, gotoDashboardAsRole, loginAsRole } from './helpers/auth';
  3   | import {
  4   |   FORBIDDEN_LABELS,
  5   |   REQUIRED_VISIBLE_LABELS,
  6   |   STAKEHOLDER_ORDER,
  7   |   getExpectedLanding,
  8   |   getExpectedActiveLabel,
  9   |   getFixture,
  10  |   getExpectedSidebar,
  11  |   toLocalizedPath,
  12  | } from './helpers/role-fixtures';
  13  | import {
  14  |   assertRedirectOrDenied,
  15  |   assertForbiddenNavLabels,
  16  |   assertHeadingOrFallback,
  17  |   assertSidebarActiveLabel,
  18  |   assertVisibleNavLabels,
  19  | } from './helpers/navigation-assertions';
  20  | 
  21  | const MOBILE_VIEWPORT = { width: 390, height: 844 };
  22  | 
  23  | test.describe('UnionEyes authenticated role-centric navigation', () => {
  24  |   test.beforeAll(async ({ request }) => {
  25  |     await bootstrapE2EAuth(request);
  26  |   });
  27  | 
  28  |   for (const role of STAKEHOLDER_ORDER) {
  29  |     test(`${role}: /dashboard redirects to centralized landing and role IA`, async ({ page }) => {
  30  |       const fixture = getFixture(role);
  31  |       const localizedLanding = await gotoDashboardAsRole(page, role);
  32  | 
  33  |       expect(localizedLanding).toContain(getExpectedLanding(role));
  34  | 
  35  |       const expectedSidebar = getExpectedSidebar(role);
  36  |       const expectedActiveLabel = getExpectedActiveLabel(role);
  37  |       await assertVisibleNavLabels(page, expectedSidebar);
  38  |       await assertVisibleNavLabels(page, REQUIRED_VISIBLE_LABELS[role]);
  39  |       await assertForbiddenNavLabels(page, FORBIDDEN_LABELS[role]);
  40  |       await assertSidebarActiveLabel(page, expectedActiveLabel);
  41  |       await assertHeadingOrFallback(page, expectedActiveLabel);
  42  | 
  43  |       await page.goto(localizedLanding, { waitUntil: 'domcontentloaded' });
  44  |       await expect(page).toHaveURL(new RegExp(`${escapeRegExp(localizedLanding)}(?:$|[/?#])`));
  45  |       await assertHeadingOrFallback(page, expectedActiveLabel);
  46  | 
  47  |       // Ensure role-irrelevant groups do not leak through role switches.
  48  |       await assertForbiddenNavLabels(page, FORBIDDEN_LABELS[role]);
  49  | 
  50  |       // Smoke assert locale is stable for signed-in routing.
  51  |       expect(page.url()).toContain(`/${fixture.locale}/`);
  52  |     });
  53  | 
  54  |     test(`${role}: mobile landing keeps nav and primary action reachable`, async ({ page }) => {
  55  |       const fixture = getFixture(role);
  56  |       await page.setViewportSize(MOBILE_VIEWPORT);
  57  |       await loginAsRole(page, role);
  58  | 
  59  |       const localizedLanding = toLocalizedPath(getExpectedLanding(role), fixture.locale);
  60  |       await page.goto(localizedLanding, { waitUntil: 'domcontentloaded' });
  61  |       await expect(page).toHaveURL(new RegExp(`${escapeRegExp(localizedLanding)}(?:$|[/?#])`));
  62  | 
  63  |       // On mobile the primary <nav> collapses behind a trigger, so the desktop
  64  |       // sidebar nav is present in the DOM but hidden. Assert the *reachable*
  65  |       // nav affordance — a visible nav, or the control that opens it.
  66  |       const reachableNav = page
  67  |         .locator('nav, [role="navigation"], button[aria-label="Open navigation"]')
  68  |         .filter({ visible: true })
  69  |         .first();
> 70  |       await expect(reachableNav).toBeVisible();
      |                                  ^ Error: expect(locator).toBeVisible() failed
  71  |       await expect(page.locator('body')).toBeVisible();
  72  |       await assertHeadingOrFallback(page, REQUIRED_VISIBLE_LABELS[role][0]);
  73  |     });
  74  |   }
  75  | 
  76  |   const leakageAttempts: Array<{ role: keyof typeof REQUIRED_VISIBLE_LABELS; target: string }> = [
  77  |     { role: 'member', target: '/dashboard/intelligence' },
  78  |     { role: 'member', target: '/dashboard/governance' },
  79  |     { role: 'staff', target: '/dashboard/admin/organizations' },
  80  |     { role: 'executive', target: '/dashboard/admin/organizations' },
  81  |     { role: 'governance', target: '/dashboard/claims/new' },
  82  |     // Wave 2 — Runtime Authority Audit: high-risk surfaces that must be gated.
  83  |     // member (level 20) and steward (level 50) are below all new gates.
  84  |     { role: 'member', target: '/dashboard/analytics-admin' },
  85  |     { role: 'member', target: '/dashboard/billing-admin' },
  86  |     { role: 'member', target: '/dashboard/compliance-admin' },
  87  |     { role: 'member', target: '/dashboard/debug' },
  88  |     { role: 'member', target: '/dashboard/cross-union-analytics' },
  89  |     { role: 'member', target: '/dashboard/sector-analytics' },
  90  |     { role: 'member', target: '/dashboard/executive-operating-intelligence' },
  91  |     { role: 'member', target: '/dashboard/clc' },
  92  |     { role: 'member', target: '/dashboard/pension/admin' },
  93  |     { role: 'member', target: '/dashboard/pension/trustee' },
  94  |     { role: 'member', target: '/dashboard/strike-fund' },
  95  |     { role: 'member', target: '/dashboard/employer-execution' },
  96  |     { role: 'steward', target: '/dashboard/billing-admin' },
  97  |     { role: 'steward', target: '/dashboard/compliance-admin' },
  98  |     { role: 'steward', target: '/dashboard/debug' },
  99  |     { role: 'steward', target: '/dashboard/clc' },
  100 |     // Wave 3 — Sovereignty layer + governance ops gates.
  101 |     // member (20) and steward (50) cannot reach internal sovereignty surfaces.
  102 |     { role: 'member', target: '/dashboard/cognition' },
  103 |     { role: 'member', target: '/dashboard/longitudinal-cognition' },
  104 |     { role: 'member', target: '/dashboard/security' },
  105 |     { role: 'member', target: '/dashboard/customer-success' },
  106 |     { role: 'member', target: '/dashboard/operations' },
  107 |     { role: 'member', target: '/dashboard/ops' },
  108 |     { role: 'steward', target: '/dashboard/cognition' },
  109 |     { role: 'steward', target: '/dashboard/longitudinal-cognition' },
  110 |     { role: 'steward', target: '/dashboard/customer-success' },
  111 |     { role: 'steward', target: '/dashboard/ops' },
  112 |   ];
  113 | 
  114 |   for (const attempt of leakageAttempts) {
  115 |     test(`${attempt.role}: cross-role route ${attempt.target} is blocked`, async ({ page }) => {
  116 |       const fixture = getFixture(attempt.role);
  117 |       const localizedLanding = await gotoDashboardAsRole(page, attempt.role);
  118 |       await assertRedirectOrDenied(
  119 |         page,
  120 |         toLocalizedPath(attempt.target, fixture.locale),
  121 |         localizedLanding,
  122 |       );
  123 |     });
  124 |   }
  125 | });
  126 | 
  127 | function escapeRegExp(value: string): string {
  128 |   return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  129 | }
  130 | 
```
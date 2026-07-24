# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\stakeholder-demo-journeys.spec.ts >> UnionEyes stakeholder demo journeys >> executive demo path is stable and continuity-safe
- Location: e2e\stakeholder-demo-journeys.spec.ts:30:7

# Error details

```
"beforeAll" hook timeout of 60000ms exceeded.
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { bootstrapE2EAuth, gotoDashboardAsRole } from './helpers/auth';
  3   | import { getFixture, toLocalizedPath } from './helpers/role-fixtures';
  4   | import { assertNoTextExposure, navigateFromSidebarOrGoto } from './helpers/navigation-assertions';
  5   | 
  6   | async function getVisiblePageText(page: Parameters<typeof assertNoTextExposure>[0]): Promise<string> {
  7   |   return (
  8   |     await page.evaluate(() => {
  9   |       const roots = [
  10  |         document.querySelector('main'),
  11  |         document.querySelector('[role="main"]'),
  12  |         document.body,
  13  |       ].filter(Boolean) as HTMLElement[];
  14  | 
  15  |       for (const root of roots) {
  16  |         const text = root.innerText?.trim();
  17  |         if (text) return text;
  18  |       }
  19  | 
  20  |       return '';
  21  |     })
  22  |   ).toLowerCase();
  23  | }
  24  | 
  25  | test.describe('UnionEyes stakeholder demo journeys', () => {
> 26  |   test.beforeAll(async ({ request }) => {
      |        ^ "beforeAll" hook timeout of 60000ms exceeded.
  27  |     await bootstrapE2EAuth(request);
  28  |   });
  29  | 
  30  |   test('executive demo path is stable and continuity-safe', async ({ page }) => {
  31  |     const fixture = getFixture('executive');
  32  |     await gotoDashboardAsRole(page, 'executive');
  33  | 
  34  |     const path: Array<{ label: string; href: string }> = [
  35  |       { label: 'Executive Overview', href: '/dashboard/intelligence?scope=executive' },
  36  |       { label: 'Continuity Insights', href: '/dashboard/continuity-intelligence' },
  37  |       { label: 'Leadership Continuity', href: '/dashboard/leadership' },
  38  |       { label: 'Continuity Operations', href: '/dashboard/executive-operating-intelligence' },
  39  |       { label: 'Member Outcomes Ledger', href: '/dashboard/outcomes' },
  40  |     ];
  41  | 
  42  |     for (const step of path) {
  43  |       await navigateFromSidebarOrGoto(page, step.label, toLocalizedPath(step.href, fixture.locale));
  44  |       await expect(page.locator('body')).toBeVisible();
  45  |     }
  46  | 
  47  |     const body = await getVisiblePageText(page);
  48  |     // The last step is the Member Outcomes Ledger (/dashboard/outcomes) which
  49  |     // shows member metrics. "outcomes" is valid executive content alongside
  50  |     // the continuity/leadership pages visited earlier in the path.
  51  |     expect(body).toMatch(/continuity|operational|leadership|outcomes/);
  52  |     expect(body).not.toMatch(/finite state machine|workflow builder|orchestration engine|ai hype/);
  53  |   });
  54  | 
  55  |   test('staff/steward demo path is operational and non-executive', async ({ page }) => {
  56  |     const fixture = getFixture('steward');
  57  |     await gotoDashboardAsRole(page, 'steward');
  58  | 
  59  |     const path: Array<{ label: string; href: string }> = [
  60  |       { label: 'Casework Console', href: '/dashboard/work' },
  61  |       { label: 'Representation Cases', href: '/dashboard/inbox?type=intake' },
  62  |       { label: 'Communications', href: '/dashboard/correspondence' },
  63  |       { label: 'Assignments', href: '/dashboard/priorities' },
  64  |       { label: 'Documents', href: '/dashboard/documents' },
  65  |     ];
  66  | 
  67  |     for (const step of path) {
  68  |       await navigateFromSidebarOrGoto(page, step.label, toLocalizedPath(step.href, fixture.locale));
  69  |       await expect(page.locator('body')).toBeVisible();
  70  |     }
  71  | 
  72  |     const body = await getVisiblePageText(page);
  73  |     expect(body).not.toContain('executive overview');
  74  |     expect(body).not.toContain('leadership continuity');
  75  |   });
  76  | 
  77  |   test('governance demo path is explainability-safe and non-surveillance', async ({ page }) => {
  78  |     const fixture = getFixture('governance');
  79  |     await gotoDashboardAsRole(page, 'governance');
  80  | 
  81  |     const path: Array<{ label: string; href: string }> = [
  82  |       { label: 'Governance Overview', href: '/dashboard/governance' },
  83  |       { label: 'Trust & Explainability', href: '/dashboard/trust' },
  84  |       { label: 'Audit & Evidence', href: '/dashboard/audits' },
  85  |       { label: 'Continuity Signals', href: '/dashboard/continuity-intelligence' },
  86  |     ];
  87  | 
  88  |     for (const step of path) {
  89  |       await navigateFromSidebarOrGoto(page, step.label, toLocalizedPath(step.href, fixture.locale));
  90  |       await expect(page.locator('body')).toBeVisible();
  91  |     }
  92  | 
  93  |     const body = await getVisiblePageText(page);
  94  |     expect(body).toMatch(/trust|governance|audit|continuity|explainability/);
  95  |     expect(body).not.toMatch(/surveillance|worker monitoring|employee tracking/);
  96  |   });
  97  | 
  98  |   test('member demo path remains simple and non-governance', async ({ page }) => {
  99  |     const fixture = getFixture('member');
  100 |     await gotoDashboardAsRole(page, 'member');
  101 | 
  102 |     const path: Array<{ label: string; href: string }> = [
  103 |       { label: 'My Cases', href: '/dashboard/inbox?type=intake' },
  104 |       { label: 'Open Representation Case', href: '/dashboard/claims/new' },
  105 |       { label: 'Messages', href: '/dashboard/inbox?type=message' },
  106 |       { label: 'Documents', href: '/dashboard/documents' },
  107 |     ];
  108 | 
  109 |     for (const step of path) {
  110 |       await navigateFromSidebarOrGoto(page, step.label, toLocalizedPath(step.href, fixture.locale));
  111 |       await expect(page.locator('body')).toBeVisible();
  112 |     }
  113 | 
  114 |     const body = await getVisiblePageText(page);
  115 |     expect(body).not.toContain('governance overview');
  116 |     expect(body).not.toContain('executive overview');
  117 |     expect(body).not.toContain('users & roles');
  118 |   });
  119 | 
  120 |   test('admin demo path exposes controls and pilot configuration', async ({ page }) => {
  121 |     const fixture = getFixture('admin');
  122 |     await gotoDashboardAsRole(page, 'admin');
  123 | 
  124 |     const path: Array<{ label: string; href: string }> = [
  125 |       { label: 'Organization', href: '/dashboard/admin/organizations' },
  126 |       { label: 'Users & Roles', href: '/dashboard/admin/members' },
```
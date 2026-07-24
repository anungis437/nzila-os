# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\no-fsm-overexposure.spec.ts >> No FSM overexposure in pilot-facing UX >> staff: raw FSM terms are hidden across role journey
- Location: e2e\no-fsm-overexposure.spec.ts:25:9

# Error details

```
Error: page.goto: net::ERR_ABORTED at http://localhost:3002/en-CA/dashboard/settings
Call log:
  - navigating to "http://localhost:3002/en-CA/dashboard/settings", waiting until "domcontentloaded"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { bootstrapE2EAuth, gotoDashboardAsRole } from './helpers/auth';
  3  | import { getFixture, toLocalizedPath, type StakeholderRole } from './helpers/role-fixtures';
  4  | import { assertNoTextExposure } from './helpers/navigation-assertions';
  5  | 
  6  | const PILOT_FACING_ROLES: StakeholderRole[] = ['member', 'staff', 'executive', 'governance', 'admin'];
  7  | 
  8  | const FORBIDDEN_FSM_TERMS = [
  9  |   'FSM',
  10 |   'Finite State Machine',
  11 |   'State Machine',
  12 |   'Workflow Engine',
  13 |   'Orchestration Engine',
  14 |   'Raw Workflow',
  15 |   'Transition Graph',
  16 |   'State Editor',
  17 | ];
  18 | 
  19 | test.describe('No FSM overexposure in pilot-facing UX', () => {
  20 |   test.beforeAll(async ({ request }) => {
  21 |     await bootstrapE2EAuth(request);
  22 |   });
  23 | 
  24 |   for (const role of PILOT_FACING_ROLES) {
  25 |     test(`${role}: raw FSM terms are hidden across role journey`, async ({ page }) => {
  26 |       const fixture = getFixture(role);
  27 |       await gotoDashboardAsRole(page, role);
  28 |       await assertNoTextExposure(page, FORBIDDEN_FSM_TERMS);
  29 | 
  30 |       const sampleRoutes = [
  31 |         '/dashboard',
  32 |         '/dashboard/settings',
  33 |       ];
  34 | 
  35 |       for (const path of sampleRoutes) {
> 36 |         await page.goto(toLocalizedPath(path, fixture.locale), { waitUntil: 'domcontentloaded' });
     |                    ^ Error: page.goto: net::ERR_ABORTED at http://localhost:3002/en-CA/dashboard/settings
  37 |         await expect(page).not.toHaveURL(/sign[-/]?in|login/i);
  38 |         await assertNoTextExposure(page, FORBIDDEN_FSM_TERMS);
  39 |       }
  40 | 
  41 |       // Governance-safe continuity language should remain present on continuity surfaces.
  42 |       if (role === 'executive' || role === 'governance') {
  43 |         await page.goto(toLocalizedPath('/dashboard/continuity-intelligence', fixture.locale), {
  44 |           waitUntil: 'domcontentloaded',
  45 |         });
  46 |         const body = ((await page.textContent('body')) ?? '').toLowerCase();
  47 |         expect(body).toMatch(/workflow continuity|operational continuity|structured process|escalation|review|approval|continuity/);
  48 |       }
  49 |     });
  50 |   }
  51 | });
  52 | 
```
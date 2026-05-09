import { test, expect } from '@playwright/test';
import { bootstrapE2EAuth, gotoDashboardAsRole } from './helpers/auth';
import { getFixture, toLocalizedPath, type StakeholderRole } from './helpers/role-fixtures';
import { assertNoTextExposure } from './helpers/navigation-assertions';

const PILOT_FACING_ROLES: StakeholderRole[] = ['member', 'staff', 'executive', 'governance', 'admin'];

const FORBIDDEN_FSM_TERMS = [
  'FSM',
  'Finite State Machine',
  'State Machine',
  'Workflow Engine',
  'Orchestration Engine',
  'Raw Workflow',
  'Transition Graph',
  'State Editor',
];

test.describe('No FSM overexposure in pilot-facing UX', () => {
  test.beforeAll(async ({ request }) => {
    await bootstrapE2EAuth(request);
  });

  for (const role of PILOT_FACING_ROLES) {
    test(`${role}: raw FSM terms are hidden across role journey`, async ({ page }) => {
      const fixture = getFixture(role);
      await gotoDashboardAsRole(page, role);
      await assertNoTextExposure(page, FORBIDDEN_FSM_TERMS);

      const sampleRoutes = [
        '/dashboard',
        '/dashboard/settings',
      ];

      for (const path of sampleRoutes) {
        await page.goto(toLocalizedPath(path, fixture.locale), { waitUntil: 'domcontentloaded' });
        await expect(page.locator('body')).toBeVisible();
        await assertNoTextExposure(page, FORBIDDEN_FSM_TERMS);
      }

      // Governance-safe continuity language should remain present on continuity surfaces.
      if (role === 'executive' || role === 'governance') {
        await page.goto(toLocalizedPath('/dashboard/continuity-intelligence', fixture.locale), {
          waitUntil: 'domcontentloaded',
        });
        const body = ((await page.textContent('body')) ?? '').toLowerCase();
        expect(body).toMatch(/workflow continuity|operational continuity|structured process|escalation|review|approval|continuity/);
      }
    });
  }
});

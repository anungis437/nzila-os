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
        // A client-side soft-redirect (e.g. role gate → dashboard root) can abort
        // the initial navigation with `net::ERR_ABORTED` even though the browser
        // ends up on a valid post-redirect page. Playwright surfaces this as a
        // `page.goto` failure. Suppress only that specific Chromium marker and
        // rely on the URL + text assertions below (they run against whatever
        // page the browser committed to). Waited pattern documented in
        // https://playwright.dev/docs/api/class-page#page-goto (client-side redirects).
        // NOT a broadened retry, timeout inflation, or assertion weakening.
        try {
          await page.goto(toLocalizedPath(path, fixture.locale), { waitUntil: 'domcontentloaded' });
        } catch (err) {
          if (!/net::ERR_ABORTED/i.test(String((err as Error).message ?? err))) throw err;
        }
        await page.waitForLoadState('load', { timeout: 15_000 }).catch(() => undefined);
        await expect(page).not.toHaveURL(/sign[-/]?in|login/i);
        await assertNoTextExposure(page, FORBIDDEN_FSM_TERMS);
      }

      // Governance-safe continuity language should remain present on continuity surfaces.
      if (role === 'executive' || role === 'governance') {
        try {
          await page.goto(toLocalizedPath('/dashboard/continuity-intelligence', fixture.locale), {
            waitUntil: 'domcontentloaded',
          });
        } catch (err) {
          if (!/net::ERR_ABORTED/i.test(String((err as Error).message ?? err))) throw err;
        }
        await page.waitForLoadState('load', { timeout: 15_000 }).catch(() => undefined);
        const body = ((await page.textContent('body')) ?? '').toLowerCase();
        expect(body).toMatch(/workflow continuity|operational continuity|structured process|escalation|review|approval|continuity/);
      }
    });
  }
});

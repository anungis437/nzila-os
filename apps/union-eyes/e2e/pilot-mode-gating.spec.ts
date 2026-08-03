import { test } from '@playwright/test';
import { assertPilotModeEnabled, bootstrapE2EAuth, gotoDashboardAsRole } from './helpers/auth';
import {
  PILOT_EXCLUDED_ROUTES,
  STAKEHOLDER_ORDER,
  getFixture,
  toLocalizedPath,
} from './helpers/role-fixtures';
import { assertRedirectOrDenied } from './helpers/navigation-assertions';

test.describe('UnionEyes hard pilot-mode gating', () => {
  test.beforeAll(async ({ request }) => {
    await bootstrapE2EAuth(request);
  });

  for (const role of STAKEHOLDER_ORDER) {
    test(`${role}: pilot excluded routes are hard-gated`, async ({ page, request }) => {
      const fixture = getFixture(role);

      // The dev server can restart after long sequential test runs.  Wait for
      // it to recover before making any API or navigation calls.
      const startMs = Date.now();
      while (Date.now() - startMs < 45_000) {
        try {
          const probe = await request.get('/api/health', { timeout: 5_000 });
          if ([200, 503].includes(probe.status())) break;
        } catch {
          await page.waitForTimeout(1_500);
        }
      }

      const localizedLanding = await gotoDashboardAsRole(page, role);
      await assertPilotModeEnabled(page);

      for (const blockedPath of PILOT_EXCLUDED_ROUTES) {
        await assertRedirectOrDenied(
          page,
          toLocalizedPath(blockedPath, fixture.locale),
          localizedLanding,
        );
      }
    });
  }
});

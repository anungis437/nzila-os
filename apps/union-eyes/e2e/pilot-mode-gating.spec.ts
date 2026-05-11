import { test } from '@playwright/test';
import { assertPilotModeEnabled, bootstrapE2EAuth, gotoDashboardAsRole } from './helpers/auth';
import {
  PILOT_EXCLUDED_ROUTES,
  STAKEHOLDER_ORDER,
  getFixture,
  toLocalizedPath,
} from './helpers/role-fixtures';
import { assertRedirectOrDenied } from './helpers/navigation-assertions';

test.describe('Union Eyes hard pilot-mode gating', () => {
  test.beforeAll(async ({ request }) => {
    await bootstrapE2EAuth(request);
  });

  for (const role of STAKEHOLDER_ORDER) {
    test(`${role}: pilot excluded routes are hard-gated`, async ({ page }) => {
      const fixture = getFixture(role);
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

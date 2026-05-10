import { test, expect } from '@playwright/test';
import { bootstrapE2EAuth, gotoDashboardAsRole, loginAsRole } from './helpers/auth';
import {
  FORBIDDEN_LABELS,
  REQUIRED_VISIBLE_LABELS,
  STAKEHOLDER_ORDER,
  getExpectedLanding,
  getFixture,
  getExpectedSidebar,
  toLocalizedPath,
} from './helpers/role-fixtures';
import {
  assertRedirectOrDenied,
  assertForbiddenNavLabels,
  assertHeadingOrFallback,
  assertSidebarActiveLabel,
  assertVisibleNavLabels,
} from './helpers/navigation-assertions';

const MOBILE_VIEWPORT = { width: 390, height: 844 };

test.describe('Union Eyes authenticated role-centric navigation', () => {
  test.beforeAll(async ({ request }) => {
    await bootstrapE2EAuth(request);
  });

  for (const role of STAKEHOLDER_ORDER) {
    test(`${role}: /dashboard redirects to centralized landing and role IA`, async ({ page }) => {
      const fixture = getFixture(role);
      const localizedLanding = await gotoDashboardAsRole(page, role);

      expect(localizedLanding).toContain(getExpectedLanding(role));

      const expectedSidebar = getExpectedSidebar(role);
      await assertVisibleNavLabels(page, expectedSidebar);
      await assertVisibleNavLabels(page, REQUIRED_VISIBLE_LABELS[role]);
      await assertForbiddenNavLabels(page, FORBIDDEN_LABELS[role]);
      await assertSidebarActiveLabel(page, expectedSidebar[0]);
      await assertHeadingOrFallback(page, expectedSidebar[0]);

      await page.goto(localizedLanding, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(new RegExp(`${escapeRegExp(localizedLanding)}(?:$|[/?#])`));
      await assertHeadingOrFallback(page, expectedSidebar[0]);

      // Ensure role-irrelevant groups do not leak through role switches.
      await assertForbiddenNavLabels(page, FORBIDDEN_LABELS[role]);

      // Smoke assert locale is stable for signed-in routing.
      expect(page.url()).toContain(`/${fixture.locale}/`);
    });

    test(`${role}: mobile landing keeps nav and primary action reachable`, async ({ page }) => {
      const fixture = getFixture(role);
      await page.setViewportSize(MOBILE_VIEWPORT);
      await loginAsRole(page, role);

      const localizedLanding = toLocalizedPath(getExpectedLanding(role), fixture.locale);
      await page.goto(localizedLanding, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(new RegExp(`${escapeRegExp(localizedLanding)}(?:$|[/?#])`));

      await expect(page.locator('nav, [role="navigation"]').first()).toBeVisible();
      await expect(page.locator('body')).toBeVisible();
      await assertHeadingOrFallback(page, REQUIRED_VISIBLE_LABELS[role][0]);
    });
  }

  const leakageAttempts: Array<{ role: keyof typeof REQUIRED_VISIBLE_LABELS; target: string }> = [
    { role: 'member', target: '/dashboard/intelligence' },
    { role: 'member', target: '/dashboard/governance' },
    { role: 'staff', target: '/dashboard/admin/organizations' },
    { role: 'executive', target: '/dashboard/admin/organizations' },
    { role: 'governance', target: '/dashboard/claims/new' },
  ];

  for (const attempt of leakageAttempts) {
    test(`${attempt.role}: cross-role route ${attempt.target} is blocked`, async ({ page }) => {
      const fixture = getFixture(attempt.role);
      const localizedLanding = await gotoDashboardAsRole(page, attempt.role);
      await assertRedirectOrDenied(
        page,
        toLocalizedPath(attempt.target, fixture.locale),
        localizedLanding,
      );
    });
  }
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

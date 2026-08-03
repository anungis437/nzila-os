import { test, expect } from '@playwright/test';
import { bootstrapE2EAuth, gotoDashboardAsRole, loginAsRole } from './helpers/auth';
import {
  FORBIDDEN_LABELS,
  REQUIRED_VISIBLE_LABELS,
  STAKEHOLDER_ORDER,
  getExpectedLanding,
  getExpectedActiveLabel,
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

test.describe('UnionEyes authenticated role-centric navigation', () => {
  test.beforeAll(async ({ request }) => {
    await bootstrapE2EAuth(request);
  }, 180_000);

  for (const role of STAKEHOLDER_ORDER) {
    test(`${role}: /dashboard redirects to centralized landing and role IA`, async ({ page }) => {
      const fixture = getFixture(role);
      const localizedLanding = await gotoDashboardAsRole(page, role);

      // Role-resolution regression: the landing URL proves the server resolved this
      // persona's role correctly before rendering. A wrong landing (e.g., governance
      // user on /workspace) indicates auto-provisioning overwrote the seeded role.
      const expectedLandingForRole = getExpectedLanding(role);
      expect(
        localizedLanding,
        `[role-seeding] ${role} (${fixture.userRole}) resolved wrong experience. ` +
          `Expected landing: ${expectedLandingForRole}, got: ${localizedLanding}. ` +
          `Check: organizationMembers seeded for ${fixture.userId} with ${fixture.userRole}?`,
      ).toContain(expectedLandingForRole);

      const expectedSidebar = getExpectedSidebar(role);
      const expectedActiveLabel = getExpectedActiveLabel(role);
      await assertVisibleNavLabels(page, expectedSidebar);
      await assertForbiddenNavLabels(page, FORBIDDEN_LABELS[role]);
      await assertSidebarActiveLabel(page, expectedActiveLabel);
      await assertHeadingOrFallback(page, expectedActiveLabel);

      try {
        await page.goto(localizedLanding, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // Only ERR_ABORTED is tolerated: the dev server issues an internal redirect
        // while navigating to the already-resolved landing. All other errors rethrow.
        if (!message.includes('net::ERR_ABORTED')) throw error;
        // After absorbing the abort, wait for the redirect to settle before asserting.
        await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
      }

      await expect(page).toHaveURL(new RegExp(`${escapeRegExp(localizedLanding)}(?:$|[/?#])`));
      await assertHeadingOrFallback(page, expectedActiveLabel);

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

      // On mobile the primary <nav> collapses behind a trigger, so the desktop
      // sidebar nav is present in the DOM but hidden. Assert the *reachable*
      // nav affordance — a visible nav, or the control that opens it.
      const reachableNav = page
        .locator('nav, [role="navigation"], button[aria-label="Open navigation"]')
        .filter({ visible: true })
        .first();
      await expect(reachableNav).toBeVisible();
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
    // Wave 2 — Runtime Authority Audit: high-risk surfaces that must be gated.
    // member (level 20) and steward (level 50) are below all new gates.
    { role: 'member', target: '/dashboard/analytics-admin' },
    { role: 'member', target: '/dashboard/billing-admin' },
    { role: 'member', target: '/dashboard/compliance-admin' },
    { role: 'member', target: '/dashboard/debug' },
    { role: 'member', target: '/dashboard/cross-union-analytics' },
    { role: 'member', target: '/dashboard/sector-analytics' },
    { role: 'member', target: '/dashboard/executive-operating-intelligence' },
    { role: 'member', target: '/dashboard/clc' },
    { role: 'member', target: '/dashboard/pension/admin' },
    { role: 'member', target: '/dashboard/pension/trustee' },
    { role: 'member', target: '/dashboard/strike-fund' },
    { role: 'member', target: '/dashboard/employer-execution' },
    { role: 'steward', target: '/dashboard/billing-admin' },
    { role: 'steward', target: '/dashboard/compliance-admin' },
    { role: 'steward', target: '/dashboard/debug' },
    { role: 'steward', target: '/dashboard/clc' },
    // Wave 3 — Sovereignty layer + governance ops gates.
    // member (20) and steward (50) cannot reach internal sovereignty surfaces.
    { role: 'member', target: '/dashboard/cognition' },
    { role: 'member', target: '/dashboard/longitudinal-cognition' },
    { role: 'member', target: '/dashboard/security' },
    { role: 'member', target: '/dashboard/customer-success' },
    { role: 'member', target: '/dashboard/operations' },
    { role: 'member', target: '/dashboard/ops' },
    { role: 'steward', target: '/dashboard/cognition' },
    { role: 'steward', target: '/dashboard/longitudinal-cognition' },
    { role: 'steward', target: '/dashboard/customer-success' },
    { role: 'steward', target: '/dashboard/ops' },
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

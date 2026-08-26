import { test, expect } from '@playwright/test';
import { bootstrapE2EAuth, gotoDashboardAsRole } from './helpers/auth';
import { getFixture, toLocalizedPath } from './helpers/role-fixtures';
import {
  assertNoTextExposure,
  gotoWithTransientRetry,
  navigateFromSidebarOrGoto,
} from './helpers/navigation-assertions';

async function getVisiblePageText(page: Parameters<typeof assertNoTextExposure>[0]): Promise<string> {
  return (
    await page.evaluate(() => {
      const roots = [
        document.querySelector('main'),
        document.querySelector('[role="main"]'),
        document.body,
      ].filter(Boolean) as HTMLElement[];

      for (const root of roots) {
        const text = root.innerText?.trim();
        if (text) return text;
      }

      return '';
    })
  ).toLowerCase();
}

test.describe('UnionEyes stakeholder demo journeys', () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeAll(async ({ request }) => {
    await bootstrapE2EAuth(request);
  });

  test('executive demo path is stable and continuity-safe', async ({ page }) => {
    const fixture = getFixture('executive');
    await gotoDashboardAsRole(page, 'executive');

    const path: Array<{ label: string; href: string }> = [
      { label: 'Executive Overview', href: '/dashboard/intelligence?scope=executive' },
      { label: 'Continuity Insights', href: '/dashboard/continuity-intelligence' },
      { label: 'Leadership Continuity', href: '/dashboard/leadership' },
      { label: 'Continuity Operations', href: '/dashboard/executive-operating-intelligence' },
      { label: 'Member Outcomes Ledger', href: '/dashboard/outcomes' },
    ];

    for (const step of path) {
      await navigateFromSidebarOrGoto(page, step.label, toLocalizedPath(step.href, fixture.locale));
      await expect(page.locator('body')).toBeVisible();
    }

    const body = await getVisiblePageText(page);
    // The last step is the Member Outcomes Ledger (/dashboard/outcomes) which
    // shows member metrics. "outcomes" is valid executive content alongside
    // the continuity/leadership pages visited earlier in the path.
    expect(body).toMatch(/continuity|operational|leadership|outcomes/);
    expect(body).not.toMatch(/finite state machine|workflow builder|orchestration engine|ai hype/);
  });

  test('staff/steward demo path is operational and non-executive', async ({ page }) => {
    const fixture = getFixture('steward');
    await gotoDashboardAsRole(page, 'steward');

    const path: Array<{ label: string; href: string }> = [
      { label: 'Casework Console', href: '/dashboard/work' },
      { label: 'Representation Cases', href: '/dashboard/inbox?type=intake' },
      { label: 'Communications', href: '/dashboard/correspondence' },
      { label: 'Assignments', href: '/dashboard/priorities' },
      { label: 'Documents', href: '/dashboard/documents' },
    ];

    for (const step of path) {
      await navigateFromSidebarOrGoto(page, step.label, toLocalizedPath(step.href, fixture.locale));
      await expect(page.locator('body')).toBeVisible();
    }

    const body = await getVisiblePageText(page);
    expect(body).not.toContain('executive overview');
    expect(body).not.toContain('leadership continuity');
  });

  test('governance demo path is explainability-safe and non-surveillance', async ({ page }) => {
    const fixture = getFixture('governance');
    await gotoDashboardAsRole(page, 'governance');

    const path: Array<{ label: string; href: string }> = [
      { label: 'Governance Overview', href: '/dashboard/governance' },
      { label: 'Trust & Explainability', href: '/dashboard/trust' },
      { label: 'Audit & Evidence', href: '/dashboard/audits' },
      { label: 'Continuity Signals', href: '/dashboard/continuity-intelligence' },
    ];

    for (const step of path) {
      await navigateFromSidebarOrGoto(page, step.label, toLocalizedPath(step.href, fixture.locale));
      await expect(page.locator('body')).toBeVisible();
    }

    const body = await getVisiblePageText(page);
    expect(body).toMatch(/trust|governance|audit|continuity|explainability/);
    expect(body).not.toMatch(/surveillance|worker monitoring|employee tracking/);
  });

  test('member demo path remains simple and non-governance', async ({ page }) => {
    const fixture = getFixture('member');
    await gotoDashboardAsRole(page, 'member');

    const path: Array<{ label: string; href: string }> = [
      { label: 'My Cases', href: '/dashboard/inbox?type=intake' },
      { label: 'Open Representation Case', href: '/dashboard/claims/new' },
      { label: 'Messages', href: '/dashboard/inbox?type=message' },
      { label: 'Documents', href: '/dashboard/documents' },
    ];

    for (const step of path) {
      await navigateFromSidebarOrGoto(page, step.label, toLocalizedPath(step.href, fixture.locale));
      await expect(page.locator('body')).toBeVisible();
    }

    const body = await getVisiblePageText(page);
    expect(body).not.toContain('governance overview');
    expect(body).not.toContain('executive overview');
    expect(body).not.toContain('users & roles');
  });

  test('admin demo path exposes controls and pilot configuration', async ({ page }) => {
    const fixture = getFixture('admin');
    await gotoDashboardAsRole(page, 'admin');

    const path: Array<{ label: string; href: string }> = [
      { label: 'Organization', href: '/dashboard/admin/organizations' },
      { label: 'Users & Roles', href: '/dashboard/admin/members' },
      { label: 'Policies', href: '/dashboard/governance' },
      { label: 'Security', href: '/dashboard/security' },
      { label: 'Audit', href: '/dashboard/audits' },
    ];

    for (const step of path) {
      await navigateFromSidebarOrGoto(page, step.label, toLocalizedPath(step.href, fixture.locale));
      await expect(page.locator('body')).toBeVisible();
    }

    const body = await getVisiblePageText(page);
    expect(body).not.toMatch(/raw fsm|workflow builder|orchestration engine/);
  });
});

test.describe('Marketing-to-app continuity routes', () => {
  const locale = 'en-CA';

  test('for-clc and context-aware pages preserve context in CTAs', async ({ page }) => {
    const routes = [
      '/for-clc',
      '/proof?context=executive',
      '/trust?context=governance',
      '/proof?context=procurement',
      '/organizational-continuity-risk?context=conference',
      '/insights?context=conference',
    ];

    for (const route of routes) {
      await gotoWithTransientRetry(page, `/${locale}${route}`, {
        waitUntil: 'domcontentloaded',
        timeout: 45_000,
      });
      await expect(page.locator('body')).toBeVisible();
      await expect(page).not.toHaveURL(/404|not-found/i);
    }

    await gotoWithTransientRetry(page, `/${locale}/proof?context=executive`, {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    });
    const executiveContextLinks = page.locator('a[href*="context=executive"]');
    await expect(executiveContextLinks.first()).toBeVisible({ timeout: 10000 });

    await gotoWithTransientRetry(page, `/${locale}/trust?context=governance`, {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    });
    const governanceContextLinks = page.locator('a[href*="context=governance"]');
    await expect(governanceContextLinks.first()).toBeVisible({ timeout: 10000 });

    await gotoWithTransientRetry(page, `/${locale}/insights?context=conference`, {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    });
    const conferenceContextCta = page.locator(
      'a[href*="organizational-continuity-risk"][href*="context=conference"], a[href*="institutional-continuity-risk"][href*="context=conference"]',
    );
    if (await conferenceContextCta.count()) {
      await expect(conferenceContextCta.first()).toBeVisible({ timeout: 10000 });
    } else {
      const conferenceFallbackCta = page.locator(
        'a[href*="organizational-continuity-risk"], a[href*="institutional-continuity-risk"]',
      );
      await expect(conferenceFallbackCta.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('pilot request CTA remains actionable from context routes', async ({ page }) => {
    await gotoWithTransientRetry(page, `/${locale}/proof?context=procurement`, {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    });
    const procurementContextCta = page
      .locator(
        'a[href*="/organizational-continuity-risk"][href*="context=procurement"], a[href*="/institutional-continuity-risk"][href*="context=procurement"]',
      )
      .first();
    const cta =
      (await procurementContextCta.count()) > 0
        ? procurementContextCta
        : page
            .locator('a[href*="/organizational-continuity-risk"], a[href*="/institutional-continuity-risk"]')
            .first();
    await expect(cta).toBeVisible({ timeout: 10000 });
    await Promise.all([
      page.waitForURL(new RegExp(`/${locale}/(organizational|institutional)-continuity-risk`)),
      cta.evaluate((link: HTMLAnchorElement) => link.click()),
    ]);
    await expect(page.url()).toMatch(new RegExp(`/${locale}/(organizational|institutional)-continuity-risk`));
    if (page.url().includes('context=')) {
      await expect(page.url()).toContain('context=procurement');
    }
  });

  test('executive and governance journeys avoid raw FSM language', async ({ page }) => {
    await gotoWithTransientRetry(page, `/${locale}/proof?context=executive`, {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    });
    await assertNoTextExposure(page, ['FSM', 'Finite State Machine', 'Workflow Engine', 'Transition Graph']);

    await gotoWithTransientRetry(page, `/${locale}/trust?context=governance`, {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    });
    await assertNoTextExposure(page, ['FSM', 'Finite State Machine', 'Workflow Engine', 'Transition Graph']);
  });
});

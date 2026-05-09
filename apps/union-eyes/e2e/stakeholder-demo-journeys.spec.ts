import { test, expect } from '@playwright/test';
import { bootstrapE2EAuth, gotoDashboardAsRole } from './helpers/auth';
import { getFixture, toLocalizedPath } from './helpers/role-fixtures';
import { assertNoTextExposure, navigateFromSidebarOrGoto } from './helpers/navigation-assertions';

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

test.describe('Union Eyes stakeholder demo journeys', () => {
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
      { label: 'Operational Health', href: '/dashboard/executive-operating-intelligence' },
      { label: 'Outcomes', href: '/dashboard/outcomes' },
    ];

    for (const step of path) {
      await navigateFromSidebarOrGoto(page, step.label, toLocalizedPath(step.href, fixture.locale));
      await expect(page.locator('body')).toBeVisible();
    }

    const body = await getVisiblePageText(page);
    expect(body).toMatch(/continuity|operational|leadership/);
    expect(body).not.toMatch(/finite state machine|workflow builder|orchestration engine|ai hype/);
  });

  test('staff/steward demo path is operational and non-executive', async ({ page }) => {
    const fixture = getFixture('steward');
    await gotoDashboardAsRole(page, 'steward');

    const path: Array<{ label: string; href: string }> = [
      { label: 'Workbench', href: '/dashboard/workbench' },
      { label: 'Cases', href: '/dashboard/claims' },
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
      { label: 'My Cases', href: '/dashboard/inbox' },
      { label: 'Submit Request', href: '/dashboard/claims/new' },
      { label: 'Messages', href: '/dashboard/messages' },
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
      '/pilot-request?context=conference',
      '/insights?context=conference',
    ];

    for (const route of routes) {
      await page.goto(`/${locale}${route}`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('body')).toBeVisible();
      await expect(page).not.toHaveURL(/404|not-found/i);
    }

    await page.goto(`/${locale}/proof?context=executive`, { waitUntil: 'domcontentloaded' });
    const executiveContextLinks = page.locator('a[href*="context=executive"]');
    await expect(executiveContextLinks.first()).toBeVisible({ timeout: 10000 });

    await page.goto(`/${locale}/trust?context=governance`, { waitUntil: 'domcontentloaded' });
    const governanceContextLinks = page.locator('a[href*="context=governance"]');
    await expect(governanceContextLinks.first()).toBeVisible({ timeout: 10000 });

    await page.goto(`/${locale}/insights?context=conference`, { waitUntil: 'domcontentloaded' });
    const conferencePilotCta = page.locator('a[href*="pilot-request"][href*="context=conference"]');
    await expect(conferencePilotCta.first()).toBeVisible({ timeout: 10000 });
  });

  test('pilot request CTA remains actionable from context routes', async ({ page }) => {
    await page.goto(`/${locale}/proof?context=procurement`, { waitUntil: 'domcontentloaded' });
    const cta = page.locator('main a[href*="pilot-request"]').first();
    await expect(cta).toBeVisible({ timeout: 10000 });
    await cta.click();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.url()).toContain(`/${locale}/pilot-request`);
  });

  test('executive and governance journeys avoid raw FSM language', async ({ page }) => {
    await page.goto(`/${locale}/proof?context=executive`, { waitUntil: 'domcontentloaded' });
    await assertNoTextExposure(page, ['FSM', 'Finite State Machine', 'Workflow Engine', 'Transition Graph']);

    await page.goto(`/${locale}/trust?context=governance`, { waitUntil: 'domcontentloaded' });
    await assertNoTextExposure(page, ['FSM', 'Finite State Machine', 'Workflow Engine', 'Transition Graph']);
  });
});

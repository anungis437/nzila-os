import type { APIRequestContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { ensureServerReady, getBaseUrl, loginAsTestUser, seedOrVerifyTestState } from '../../tests/e2e/_helpers';
import { getExpectedLanding, getFixture, toLocalizedPath, type StakeholderRole } from './role-fixtures';

export async function bootstrapE2EAuth(request: APIRequestContext): Promise<void> {
  await ensureServerReady(request);
  await seedOrVerifyTestState(request);
}

export async function loginAsRole(page: Page, role: StakeholderRole): Promise<void> {
  const fixture = getFixture(role);
  const baseUrl = new URL(getBaseUrl());
  const cookieUrl = baseUrl.toString();

  const orgContextCookies = [
    {
      name: 'selected_org_id',
      value: fixture.orgId,
      url: cookieUrl,
      httpOnly: false,
      secure: false,
      sameSite: 'Lax' as const,
    },
    {
      name: 'selected_organization_id',
      value: fixture.orgId,
      url: cookieUrl,
      httpOnly: false,
      secure: false,
      sameSite: 'Lax' as const,
    },
    {
      name: 'selected_tenant_id',
      value: fixture.orgId,
      url: cookieUrl,
      httpOnly: false,
      secure: false,
      sameSite: 'Lax' as const,
    },
    {
      name: 'active-organization',
      value: '',
      url: cookieUrl,
      expires: 0,
      httpOnly: false,
      secure: false,
      sameSite: 'Lax' as const,
    },
  ];

  if ((process.env.PLAYWRIGHT_TEST_AUTH ?? '').toLowerCase() === 'true') {
    // Phase 0C.2 §11 — reconcile with §8 persona storageState.
    //
    // When Playwright loads a project's storageState (e.g.
    // `playwright/.auth/<role>.json`), the context already carries a real
    // `nzila_session` cookie backed by a PG session row. Injecting a
    // synthetic `nzila_session=ue-seed-session-*` on top of that would
    // overwrite the valid cookie with garbage and break every test that
    // relies on the real persona (dashboard renders, RBAC checks,
    // organization_members lookups).
    //
    // Contract:
    //   • If a real `nzila_session` cookie is present → apply ONLY
    //     org-context cookies and return; do NOT touch nzila_session.
    //   • Otherwise → keep the legacy synthetic-cookie behaviour so
    //     specs written before §8 (which never opted into storageState)
    //     continue to work.
    const existing = await page.context().cookies(cookieUrl);
    const hasRealSession = existing.some((c) => c.name === 'nzila_session' && c.value.length > 0);
    if (hasRealSession) {
      await page.context().addCookies(orgContextCookies);
      return;
    }
    await page.context().addCookies([
      {
        name: 'nzila_session',
        value: `ue-seed-session-${fixture.userId}`,
        url: cookieUrl,
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
      ...orgContextCookies,
    ]);

    return;
  }

  await loginAsTestUser(page.request, fixture.email);
  await page.context().addCookies(orgContextCookies);
}

export async function gotoDashboardAsRole(page: Page, role: StakeholderRole): Promise<string> {
  const fixture = getFixture(role);
  await loginAsRole(page, role);
  await page.goto(toLocalizedPath('/dashboard', fixture.locale), { waitUntil: 'domcontentloaded' });
  const landing = toLocalizedPath(getExpectedLanding(role), fixture.locale);
  await expect(page).toHaveURL(new RegExp(`${escapeRegExp(landing)}(?:$|[/?#])`));
  return landing;
}

export async function assertPilotModeEnabled(page: Page): Promise<void> {
  const response = await page.request.get('/api/feature-flags?flag=pilot-mode');
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { enabled?: boolean; flags?: Record<string, boolean> };
  const enabled = payload.enabled ?? payload.flags?.['pilot-mode'];
  expect(enabled).toBe(true);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

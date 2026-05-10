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

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
  const target = toLocalizedPath('/dashboard', fixture.locale);
  const landing = toLocalizedPath(getExpectedLanding(role), fixture.locale);
  const maxAttempts = 3;
  const transientNavigationPattern = /net::ERR_ABORTED|net::ERR_CONNECTION_REFUSED|ERR_CONNECTION_RESET|ERR_INTERNET_DISCONNECTED|timeout|net::ERR_FAILED/i;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!transientNavigationPattern.test(message)) {
        throw error;
      }
    }

    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
    const currentUrl = page.url();
    // Only accept the actual landing URL — NOT the root /dashboard target,
    // which would be a false positive (redirect hasn't fired yet).
    if (currentUrl.includes(landing)) {
      return landing;
    }

    if (currentUrl.startsWith('chrome-error://') && attempt < maxAttempts) {
      await page.waitForTimeout(750 * attempt);
      continue;
    }

    if (currentUrl.startsWith('chrome-error://')) {
      break;
    }

    try {
      await expect.poll(() => page.url(), { timeout: 20_000 }).toContain(landing);
      return landing;
    } catch {
      if (attempt < maxAttempts) {
        await page.waitForTimeout(750 * attempt);
        continue;
      }
      throw new Error(`Dashboard redirect did not reach ${landing}; last URL was ${page.url()}`);
    }
  }

  await expect.poll(() => page.url(), { timeout: 20_000 }).toContain(landing);
  return landing;
}

export async function assertPilotModeEnabled(page: Page): Promise<void> {
  const response = await page.request.get('/api/feature-flags?flag=pilot-mode');
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as { enabled?: boolean; flags?: Record<string, boolean> };
  const enabled = payload.enabled ?? payload.flags?.['pilot-mode'];
  expect(enabled).toBe(true);
}

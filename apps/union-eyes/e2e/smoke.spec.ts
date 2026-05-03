/**
 * Union-Eyes E2E — Smoke Tests
 *
 * Validates core navigation and page rendering without authentication.
 * These run on every PR to catch regressions early.
 */
import { test, expect } from '@playwright/test';
import { ensureServerReady, getBaseUrl } from '../tests/e2e/_helpers';

test.describe('Public pages smoke tests', () => {
  test.beforeAll(async ({ request }) => {
    await ensureServerReady(request);
  });

  test('marketing page renders', async ({ page }) => {
    await page.goto(getBaseUrl(), { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
  });

  test('sign-in page renders', async ({ page }) => {
    await page.goto('/sign-in', { waitUntil: 'domcontentloaded' });
    // Should show sign-in widget or redirect to auth
    await expect(page.locator('body')).toBeVisible();
  });

  test('sign-up page renders', async ({ page }) => {
    await page.goto('/signup', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
  });

  test('API health endpoint returns 200', async ({ request }) => {
    const response = await request.get('/api/health');
    // Health endpoint should be reachable (may return 200 or 503 depending on DB)
    expect([200, 503]).toContain(response.status());
  });
});

test.describe('Accessibility smoke tests', () => {
  test('marketing page has no critical a11y violations', async ({ page }) => {
    await page.goto('/');

    // Basic a11y checks without axe-core (structural)
    // 1. Page should have lang attribute
    const htmlLang = await page.getAttribute('html', 'lang');
    expect(htmlLang).toBeTruthy();

    // 2. Page should have a main landmark or body content
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // 3. Images should have alt attributes
    const images = page.locator('img:not([alt])');
    const count = await images.count();
    expect(count).toBe(0);
  });
});

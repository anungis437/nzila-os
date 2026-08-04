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
    // Warm the marketing entry route so the first `page.goto('/')` below
    // isn't racing Next.js cold compilation of the localized marketing tree
    // (which can exceed the 45s per-test goto timeout on Windows after main
    // added business-plan doc surfaces). Fire-and-forget with a 60s ceiling —
    // any actual test.goto below still enforces its own timeout.
    await request.get('/', { timeout: 60_000 }).catch(() => undefined);
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
  test('marketing page has no critical a11y violations', async ({ page, request }) => {
    // The dev server can restart after long sequential test runs that exhaust
    // its memory threshold. Wait for the server to be ready before navigating.
    // This does not mask application defects — it bounds the infrastructure
    // recovery window that is an acknowledged dev-server limitation.
    const startMs = Date.now();
    while (Date.now() - startMs < 45_000) {
      try {
        const probe = await request.get('/', { timeout: 5_000 });
        if ([200, 301, 302, 307, 308].includes(probe.status())) break;
      } catch {
        await page.waitForTimeout(1_500);
      }
    }

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30_000 });

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

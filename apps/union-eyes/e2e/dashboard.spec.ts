/**
 * Union-Eyes E2E — Dashboard Flow
 *
 * Tests authenticated dashboard navigation.
 * Uses test auth mode (PLAYWRIGHT_TEST_AUTH=true) to bypass auth.
 *
 * These tests require a running server and test auth mode enabled.
 * In CI, set PLAYWRIGHT_TEST_AUTH=true and TEST_USER_ID.
 */
import { test, expect } from '@playwright/test';
import { ensureServerReady } from '../tests/e2e/_helpers';
import { bootstrapE2EAuth, loginAsRole } from './helpers/auth';

// Skip dashboard tests if test auth mode is not enabled
const isTestAuth = process.env.PLAYWRIGHT_TEST_AUTH === 'true';

test.describe('Dashboard flows', () => {
  test.skip(!isTestAuth, 'Requires PLAYWRIGHT_TEST_AUTH=true');

  test.beforeAll(async ({ request }) => {
    await ensureServerReady(request);
    await bootstrapE2EAuth(request);
  });

  test('dashboard loads with navigation sidebar', async ({ page }) => {
    await loginAsRole(page, 'admin');
    await page.goto('/en-CA/dashboard');
    // Should show dashboard layout
    await expect(page.locator('nav, [role="navigation"]').first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('cases page loads', async ({ page }) => {
    await loginAsRole(page, 'admin');
    await page.goto('/en-CA/dashboard');
    // Cases consolidated into Inbox (intake filter) per Wave 3 runtime authority audit
    await page.goto('/en-CA/dashboard/inbox?type=intake');
    await expect(page.locator('body')).toBeVisible();
  });

  test('admin page loads for admin users', async ({ page }) => {
    await loginAsRole(page, 'admin');
    await page.goto('/en-CA/dashboard/admin');
    await expect(page.locator('body')).toBeVisible();
  });
});

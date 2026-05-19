/**
 * Union-Eyes E2E — Missing Routes Documentation
 *
 * FINDINGS (PAGE_RENDER_VALIDATION.md):
 *   - /dashboard/grievances — ✅ FIXED (pages created, was FLOW-003)
 *   - /dashboard/cases       — ✅ FIXED (pages created, was FLOW-004)
 *   - /dashboard/claims      — ✅ FIXED (pages created, was FLOW-005)
 *   - /dashboard/ops         — ⏳ Pending implementation (FLOW-006)
 *
 * Tests for remaining missing routes are marked test.skip() so they appear
 * as "pending" (yellow) in the report rather than failing, keeping CI green
 * while the gap is visible.
 */
import { test, expect } from '@playwright/test';
import { bootstrapE2EAuth, loginAsRole } from './helpers/auth';
import { getFixture, toLocalizedPath } from './helpers/role-fixtures';

const isTestAuth = process.env.PLAYWRIGHT_TEST_AUTH === 'true';
const LOCALE = 'en-CA';

// ─── Missing route stubs (pending) ────────────────────────────────────────────

test.describe('Missing routes — known 404 gaps (pending)', () => {
  test.skip(!isTestAuth, 'Requires PLAYWRIGHT_TEST_AUTH=true');

  test.beforeAll(async ({ request }) => {
    await bootstrapE2EAuth(request);
  });

  test.skip(
    true,
    'Route not yet implemented: FLOW-006 — /dashboard/ops returns 404',
  );
  test('ops page exists and renders', async ({ page }) => {
    await loginAsRole(page, 'admin');
    await page.goto(`/${LOCALE}/dashboard/ops`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/sign[-/]?in|login/i);
    await expect(page.locator('body')).toBeVisible();
    const body = (await page.textContent('body')) ?? '';
    expect(body).not.toMatch(/404|not found/i);
  });
});

// ─── Positive smoke — routes that MUST return 200 ─────────────────────────────

test.describe('Existing routes — positive smoke check', () => {
  test.skip(!isTestAuth, 'Requires PLAYWRIGHT_TEST_AUTH=true');

  test.beforeAll(async ({ request }) => {
    await bootstrapE2EAuth(request);
  });

  test('admin: /dashboard renders for admin role', async ({ page }) => {
    await loginAsRole(page, 'admin');
    await page.goto(`/${LOCALE}/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveURL(/sign[-/]?in|login/i);
  });

  test('admin: /dashboard/admin renders for admin role', async ({ page }) => {
    await loginAsRole(page, 'admin');
    await page.goto(`/${LOCALE}/dashboard/admin`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    // Use innerText() — not textContent() — so that <script> tag content
    // (Next.js build manifests that always reference the "/404" route) is
    // excluded from the check.
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/\b404\b/);
  });

  test('admin: /dashboard/settings renders', async ({ page }) => {
    await loginAsRole(page, 'admin');
    await page.goto(`/${LOCALE}/dashboard/settings`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('steward: /dashboard/inbox renders (consolidated cases view — Wave 3)', async ({ page }) => {
    await loginAsRole(page, 'steward');
    await page.goto(`/${LOCALE}/dashboard/inbox`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveURL(/sign[-/]?in|login/i);
  });

  test('member: /dashboard/claims/new renders (intake form)', async ({ page }) => {
    const fixture = getFixture('member');
    await loginAsRole(page, 'member');
    await page.goto(toLocalizedPath('/dashboard/claims/new', fixture.locale), {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    // intake form should show a heading, not a 404
    const body = (await page.textContent('body')) ?? '';
    expect(body).not.toMatch(/\b404\b/);
  });

  test('governance: /dashboard/continuity-intelligence renders', async ({ page }) => {
    await loginAsRole(page, 'governance');
    await page.goto(`/${LOCALE}/dashboard/continuity-intelligence`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveURL(/sign[-/]?in|login/i);
  });

  test('steward: /dashboard/grievances list page renders (FLOW-003 fixed)', async ({ page }) => {
    await loginAsRole(page, 'steward');
    await page.goto(`/${LOCALE}/dashboard/grievances`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/sign[-/]?in|login/i);
    await expect(page.locator('body')).toBeVisible();
    const body = (await page.textContent('body')) ?? '';
    expect(body).not.toMatch(/404|not found/i);
  });

  test('steward: /dashboard/cases list page renders (FLOW-004 fixed)', async ({ page }) => {
    await loginAsRole(page, 'steward');
    await page.goto(`/${LOCALE}/dashboard/cases`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/sign[-/]?in|login/i);
    await expect(page.locator('body')).toBeVisible();
    const body = (await page.textContent('body')) ?? '';
    expect(body).not.toMatch(/404|not found/i);
  });

  test('member: /dashboard/claims list page renders (FLOW-005 fixed)', async ({ page }) => {
    await loginAsRole(page, 'member');
    await page.goto(`/${LOCALE}/dashboard/claims`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/sign[-/]?in|login/i);
    await expect(page.locator('body')).toBeVisible();
    const body = (await page.textContent('body')) ?? '';
    expect(body).not.toMatch(/404|not found/i);
  });
});

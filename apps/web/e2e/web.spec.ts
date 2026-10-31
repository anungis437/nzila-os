/**
 * Web — E2E Tests (Playwright)
 */
import { test, expect } from '@playwright/test'

const BASE = process.env.WEB_URL ?? 'http://localhost:3000'

test.describe('Web E2E', () => {
  test('landing page renders', async ({ page }) => {
    await page.goto(`${BASE}/`)
    await expect(page).toHaveTitle(/Nzila|Home/)
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })

  test('lead capture submission — health check', async ({ request }) => {
    const res = await request.get(`${BASE}/api/health`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.service).toBe('web')
  })

  test('admin publishing — evidence export requires auth', async ({ request }) => {
    const res = await request.get(`${BASE}/api/evidence/export`)
    // Endpoint is auth-protected; expect 401 without credentials
    expect(res.status()).toBe(401)
  })
  test('human-centered product selector works and maintains real destination', async ({ page }) => {
    await page.goto(`${BASE}/`);

    const civic = page.getByRole('button', { name: 'CIVIC', exact: true });
    const union = page.getByRole('button', { name: 'Union Eyes', exact: true });
    await expect(union).toHaveAttribute('aria-pressed', 'true');
    await civic.click();
    await expect(civic).toHaveAttribute('aria-pressed', 'true');
    await expect(union).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('link', { name: /Explore CIVIC|Découvrir CIVIC/ }).first()).toHaveAttribute('href', '/public-service');
    await expect(page.getByRole('heading', { name: /Technology should strengthen human judgment|La technologie doit renforcer le jugement humain/ })).toBeVisible();
  });

  for (const width of [320, 390]) {
    test(`mobile navigation and layout remain usable at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 700 });
      await page.goto(`${BASE}/`);

      const menuButton = page.getByRole('button', { name: /navigation menu/i });
      await expect(menuButton).toBeVisible();
      await menuButton.click();
      const menu = page.locator('#mobile-navigation-menu');
      await expect(menu).toBeVisible();
      const menuBounds = await menu.boundingBox();
      expect(menuBounds).not.toBeNull();
      expect(menuBounds!.x).toBeGreaterThanOrEqual(-1);
      expect(menuBounds!.x + menuBounds!.width).toBeLessThanOrEqual(width + 1);
      expect(menuBounds!.height).toBeLessThanOrEqual(700);
      await page.keyboard.press('Escape');
      await expect(menu).toBeHidden();
      await expect(menuButton).toBeFocused();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }

  test('public product journeys disclose their maturity and human review boundaries', async ({ page }) => {
    await page.goto(`${BASE}/union-eyes`);
    await expect(page.getByText(/Pilot validation|Validation pilote/i).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /Technology should strengthen human judgment|La technologie doit renforcer le jugement humain/ })).toBeVisible();
    await page.goto(`${BASE}/public-service`);
    await expect(page.getByText(/Discovery and institutional briefings|Découverte et présentations institutionnelles/).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /Technology should strengthen human judgment|La technologie doit renforcer le jugement humain/ })).toBeVisible();
  });

})

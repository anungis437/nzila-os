import { expect, test } from '@playwright/test';
import { bootstrapE2EAuth, loginAsRole } from './helpers/auth';

test.describe('LIUNA bilingual mobile transition journey', () => {
  test.describe.configure({ timeout: 180_000 });

  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  test.beforeAll(async ({ request }) => {
    await bootstrapE2EAuth(request);
  });

  async function assertMobileRoute(page: Parameters<typeof loginAsRole>[0], path: string) {
    await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveURL(/404|not-found/i);

    const layout = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyText: document.body.innerText.toLowerCase(),
    }));

    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width + 2);
    expect(layout.bodyText).not.toMatch(/finite state machine|workflow engine|orchestration engine/i);
  }

  for (const locale of ['en-CA', 'fr-CA'] as const) {
    test(`${locale} renders the mobile continuity/case/document route set`, async ({ page }) => {
      await loginAsRole(page, 'steward');

      for (const route of [
        `/${locale}/dashboard`,
        `/${locale}/dashboard/inbox?type=intake`,
        `/${locale}/dashboard/documents`,
        `/${locale}/dashboard/organizational-memory`,
      ]) {
        await assertMobileRoute(page, route);
      }
    });
  }
});

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
    // Next.js dev-mode cold compile can abort the first navigation; retry once.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        break;
      } catch (err) {
        if (attempt === 0 && /ERR_ABORTED|net::ERR_/.test(String(err))) {
          await page.waitForTimeout(2_000);
          continue;
        }
        throw err;
      }
    }
    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveURL(/404|not-found/i);

    // Wait for any auth/i18n redirects to settle, then evaluate layout.
    // Retry the evaluate if the execution context is destroyed by a mid-flight
    // navigation (the app uses client-side redirects that can fire after load).
    let layout = { width: 0, scrollWidth: 0, bodyText: '' };
    for (let evalAttempt = 0; evalAttempt < 3; evalAttempt++) {
      try {
        await page.waitForLoadState('domcontentloaded', { timeout: 30_000 });
        await page.waitForTimeout(250);
        layout = await page.evaluate(() => {
          const docElement = document.documentElement;
          if (!docElement) {
            return { width: 0, scrollWidth: 0, bodyText: '' };
          }
          return {
            width: docElement.clientWidth || 0,
            scrollWidth: docElement.scrollWidth || 0,
            bodyText: document.body?.innerText?.toLowerCase() || '',
          };
        });
        break;
      } catch (err) {
        if (evalAttempt < 2 && /context.*destroyed|Execution context/i.test(String(err))) {
          // A navigation fired mid-evaluate; wait for the new load and retry.
          await page.waitForLoadState('domcontentloaded', { timeout: 30_000 }).catch(() => {});
          continue;
        }
        throw err;
      }
    }

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

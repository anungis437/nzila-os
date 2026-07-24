import { expect, test, type Page } from '@playwright/test';

import { ensureServerReady } from '../../tests/e2e/_helpers';

/**
 * Phase 0C.2 §14 — Accessibility smoke suite (5 test areas)
 *
 * ─────────────────────────────────────────────────────────────────────
 * Wired by §8 (playwright.config.ts):
 *
 *   {
 *     name: 'accessibility',
 *     dependencies: ['setup'],
 *     testMatch: ['e2e/a11y/**\/*.spec.ts'],
 *     use: {
 *       ...devices['Desktop Chrome'],
 *       storageState: { cookies: [], origins: [] },   // cold session
 *     },
 *   }
 *
 * ─────────────────────────────────────────────────────────────────────
 * Approach: structural DOM assertions (no external a11y dep)
 *
 *   The workspace has no `@axe-core/playwright` installed and Phase 0C
 *   scope forbids introducing new production/dev dependencies (that
 *   would touch pnpm-lock.yaml, package.json, and potentially override
 *   resolution across the monorepo). Instead this suite asserts five
 *   structural WCAG invariants directly via `page.locator(...)`.
 *
 *   Each invariant is a hard, machine-checkable HTML contract:
 *
 *     ┌───┬──────────────────────────┬─────────────────────────────────┐
 *     │ # │ Test area                │ WCAG anchor                     │
 *     ├───┼──────────────────────────┼─────────────────────────────────┤
 *     │ 1 │ <html lang> is set       │ 3.1.1 Language of Page          │
 *     │ 2 │ <img> alt attribute      │ 1.1.1 Non-text Content          │
 *     │ 3 │ Exactly one <h1>         │ 2.4.6 Headings and Labels       │
 *     │ 4 │ <a> accessible names     │ 2.4.4 Link Purpose (in Context) │
 *     │ 5 │ <button> accessible name │ 4.1.2 Name, Role, Value         │
 *     └───┴──────────────────────────┴─────────────────────────────────┘
 *
 *   Every test iterates over ROUTES so each area contributes a single
 *   `test(...)` registration (matching the "5 areas" mandate exactly)
 *   while still exercising the four canonical public-marketing pages.
 *
 * ─────────────────────────────────────────────────────────────────────
 * Route selection
 *
 *   The project runs cold (storageState: {cookies:[], origins:[]}), so
 *   only unauthenticated public routes are safe. The four marketing
 *   pages chosen here match §13 bilingual coverage for consistency and
 *   are guaranteed by `app/[locale]/(marketing)/*` to be:
 *     • static (no session gating)
 *     • locale-aware (default locale = 'en-CA')
 *     • high-signal (governance/trust, contract/pricing, narrative)
 *
 * ─────────────────────────────────────────────────────────────────────
 * Warm-up
 *
 *   `test.beforeAll(ensureServerReady)` reuses the §12-hardened helper
 *   which raises the enclosing hook budget to 180s, giving this suite
 *   the same cold-compile immunity that all §12/§13 suites inherit.
 */

const ROUTES = ['/en-CA', '/en-CA/trust', '/en-CA/pricing', '/en-CA/story'] as const;

// Locators used to derive "accessible name has content" — matches the
// AccName algorithm's dominant sources for interactive elements.
function accessibleNameSelectors(): string {
  return [
    ':has-text("")',           // any text content
    '[aria-label]:not([aria-label=""])',
    '[aria-labelledby]',
    '[title]:not([title=""])',
  ].join(', ');
}

// Void reference so the compiled helper file preserves the list at
// module scope (aids source-guard readability and static analysis).
void accessibleNameSelectors;

test.describe('Accessibility smoke — structural WCAG invariants', () => {
  test.beforeAll(async ({ request }) => {
    await ensureServerReady(request);
  });

  // ── Area 1: WCAG 3.1.1 — Language of Page ────────────────────────
  test('every marketing route sets <html lang> to a non-empty value', async ({ page }: { page: Page }) => {
    for (const route of ROUTES) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      const htmlLang = await page.locator('html').getAttribute('lang');
      expect(htmlLang, `route=${route}: <html lang> must be set`).toBeTruthy();
      expect(htmlLang?.length ?? 0, `route=${route}: <html lang> must be non-empty`).toBeGreaterThan(0);
    }
  });

  // ── Area 2: WCAG 1.1.1 — Non-text Content ────────────────────────
  test('every <img> on every marketing route has an alt attribute', async ({ page }: { page: Page }) => {
    for (const route of ROUTES) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      const imagesMissingAlt = await page.locator('img:not([alt])').count();
      expect(imagesMissingAlt, `route=${route}: <img> elements missing alt`).toBe(0);
    }
  });

  // ── Area 3: WCAG 2.4.6 — Headings and Labels ─────────────────────
  test('every marketing route has exactly one <h1>', async ({ page }: { page: Page }) => {
    for (const route of ROUTES) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      const h1Count = await page.locator('h1').count();
      expect(h1Count, `route=${route}: expected exactly one <h1>, saw ${h1Count}`).toBe(1);
    }
  });

  // ── Area 4: WCAG 2.4.4 — Link Purpose (in Context) ───────────────
  // Every visible <a> must have an accessible name (visible text OR
  // aria-label OR aria-labelledby OR a titled image child). Anchors
  // used for skip-links / decoration are excluded via [href] filter.
  test('every visible <a href> on every marketing route has an accessible name', async ({ page }: { page: Page }) => {
    for (const route of ROUTES) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      const anchors = page.locator('a[href]:visible');
      const total = await anchors.count();
      const anonymous = await page
        .locator('a[href]:visible:not(:has-text(/\\S/)):not([aria-label]):not([aria-labelledby]):not(:has(img[alt]:not([alt=""])))')
        .count();
      expect(
        anonymous,
        `route=${route}: ${anonymous} of ${total} <a> elements have no accessible name`,
      ).toBe(0);
    }
  });

  // ── Area 5: WCAG 4.1.2 — Name, Role, Value ───────────────────────
  // Every visible <button> must have an accessible name. Icon-only
  // buttons must carry aria-label; text buttons must carry text.
  test('every visible <button> on every marketing route has an accessible name', async ({ page }: { page: Page }) => {
    for (const route of ROUTES) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      const buttons = page.locator('button:visible');
      const total = await buttons.count();
      const anonymous = await page
        .locator('button:visible:not(:has-text(/\\S/)):not([aria-label]):not([aria-labelledby]):not(:has(img[alt]:not([alt=""])))')
        .count();
      expect(
        anonymous,
        `route=${route}: ${anonymous} of ${total} <button> elements have no accessible name`,
      ).toBe(0);
    }
  });
});

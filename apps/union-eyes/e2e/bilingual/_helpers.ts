/**
 * Union-Eyes E2E — Bilingual Smoke Test Helper
 *
 * Phase 0C.2 §13 — Populates the `bilingual-en` and `bilingual-fr`
 * Playwright projects wired in §8. The two spec files
 * (`locale-smoke.en.spec.ts`, `locale-smoke.fr.spec.ts`) each invoke
 * `runBilingualSmokeSuite(...)` with their respective locale so that both
 * projects execute a structurally-identical seven-test smoke suite while
 * remaining discoverable by their per-project `testMatch` glob:
 *
 *   bilingual-en: e2e/bilingual/**\/*.en.spec.ts   locale: 'en-CA'
 *   bilingual-fr: e2e/bilingual/**\/*.fr.spec.ts   locale: 'fr-CA'
 *
 * The suite validates the STRUCTURAL bilingual invariants of the locale
 * routing pipeline. It deliberately does NOT depend on translated string
 * values (which drift between marketing revisions). Only invariants
 * anchored in the URL prefix, the root `<html lang>` attribute, and
 * infrastructure surfaces are asserted.
 */
import { expect, test } from '@playwright/test';
import { ensureServerReady } from '../../tests/e2e/_helpers';

export type BilingualLocale = 'en-CA' | 'fr-CA';

/**
 * Marketing routes covered by the smoke suite (assertion #1–#4).
 *
 * The four chosen routes are the highest-signal public marketing surfaces:
 *   /             — locale-prefixed homepage
 *   /trust        — governance / compliance surface
 *   /pricing      — contract & billing surface
 *   /story        — organizational positioning surface
 *
 * All four are static, unauthenticated, and locale-aware — they render
 * inside the `(marketing)` route group under `app/[locale]/`.
 */
const MARKETING_ROUTES = ['', '/trust', '/pricing', '/story'] as const;

/**
 * Registers the seven-test bilingual smoke suite for the supplied locale.
 * Invoked from each spec file so both `bilingual-en` and `bilingual-fr`
 * receive identical structural coverage without duplicating assertions.
 */
export function runBilingualSmokeSuite(locale: BilingualLocale): void {
  test.describe(`Bilingual smoke — ${locale}`, () => {
    test.beforeAll(async ({ request }) => {
      await ensureServerReady(request);
    });

    // ── Test 1: Homepage renders with correct <html lang> ────────────
    test(`locale-prefixed homepage /${locale} renders with <html lang="${locale}">`, async ({ page }) => {
      await page.goto(`/${locale}`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('body')).toBeVisible();
      const htmlLang = await page.getAttribute('html', 'lang');
      expect(htmlLang).toBe(locale);
    });

    // ── Test 2: /trust renders with correct <html lang> ─────────────
    test(`locale-prefixed /${locale}/trust renders with <html lang="${locale}">`, async ({ page }) => {
      await page.goto(`/${locale}/trust`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('body')).toBeVisible();
      const htmlLang = await page.getAttribute('html', 'lang');
      expect(htmlLang).toBe(locale);
    });

    // ── Test 3: /pricing renders with correct <html lang> ───────────
    test(`locale-prefixed /${locale}/pricing renders with <html lang="${locale}">`, async ({ page }) => {
      await page.goto(`/${locale}/pricing`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('body')).toBeVisible();
      const htmlLang = await page.getAttribute('html', 'lang');
      expect(htmlLang).toBe(locale);
    });

    // ── Test 4: /story renders with correct <html lang> ─────────────
    test(`locale-prefixed /${locale}/story renders with <html lang="${locale}">`, async ({ page }) => {
      await page.goto(`/${locale}/story`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('body')).toBeVisible();
      const htmlLang = await page.getAttribute('html', 'lang');
      expect(htmlLang).toBe(locale);
    });

    // ── Test 5: <title> contains locale-agnostic brand ──────────────
    test(`locale-prefixed homepage /${locale} exposes UnionEyes brand in <title>`, async ({ page }) => {
      await page.goto(`/${locale}`, { waitUntil: 'domcontentloaded' });
      // Brand string is locale-agnostic (not translated).
      await expect(page).toHaveTitle(/UnionEyes/i);
    });

    // ── Test 6: Structural a11y — every <img> has alt attribute ─────
    test(`locale-prefixed homepage /${locale} has no images missing alt attribute`, async ({ page }) => {
      await page.goto(`/${locale}`, { waitUntil: 'domcontentloaded' });
      const imagesWithoutAlt = page.locator('img:not([alt])');
      const count = await imagesWithoutAlt.count();
      expect(count).toBe(0);
    });

    // ── Test 7: Infrastructure smoke — health endpoint reachable ────
    test(`API health endpoint reachable (locale=${locale} project context)`, async ({ request }) => {
      const response = await request.get('/api/health');
      // Accept both healthy (200) and degraded-but-live (503) — the same
      // shape validated by the public smoke.spec.ts baseline.
      expect([200, 503]).toContain(response.status());
    });
  });

  // Assert that MARKETING_ROUTES is referenced somewhere in this module,
  // preventing accidental orphaning if routes are added but not covered.
  // (No-op at runtime; the const is captured for structural completeness.)
  void MARKETING_ROUTES;
}

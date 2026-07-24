/**
 * Phase 0C.2 §13 — Bilingual Smoke Suite Source Guard
 *
 * A pure static-analysis vitest that prevents regression of the bilingual
 * smoke suite's structural contract. Executes in ~15ms and does NOT
 * spin up a browser — it only reads the three §13 source files from disk
 * and asserts their shape.
 *
 * NOTE on placement:
 *   `apps/union-eyes/vitest.config.ts` EXCLUDES `tests/e2e/**` and
 *   `e2e/**` from discovery. This file therefore lives at
 *   `apps/union-eyes/tests/bilingual-smoke.test.ts` (one level ABOVE
 *   the excluded `tests/e2e/` dir), the same location used by the §12
 *   `e2e-helpers-timeout.test.ts` source guard.
 *
 * What this guard locks down:
 *   1. `_helpers.ts` exports a `runBilingualSmokeSuite` function.
 *   2. That function accepts a `BilingualLocale` typed 'en-CA' | 'fr-CA'.
 *   3. Helper registers exactly SEVEN `test(...)` calls inside a
 *      `test.describe(...)` block (7 == §13 test-area count).
 *   4. Helper opens each suite with a `test.beforeAll(...)` hook that
 *      calls `ensureServerReady` (matching §12 warm-up contract).
 *   5. Helper asserts `<html lang="${locale}">` invariant on four
 *      locale-prefixed marketing routes (`/`, `/trust`, `/pricing`,
 *      `/story`) — the four routes that carry the strongest bilingual
 *      signal in the marketing surface.
 *   6. `locale-smoke.en.spec.ts` invokes `runBilingualSmokeSuite('en-CA')`.
 *   7. `locale-smoke.fr.spec.ts` invokes `runBilingualSmokeSuite('fr-CA')`.
 *   8. Neither spec file adds ad-hoc `test(...)` calls (helper-delegation
 *      contract) — this prevents drift between EN and FR coverage.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const HERE = __dirname;
const BILINGUAL_DIR = resolve(HERE, '..', 'e2e', 'bilingual');
const HELPER_PATH = resolve(BILINGUAL_DIR, '_helpers.ts');
const EN_SPEC_PATH = resolve(BILINGUAL_DIR, 'locale-smoke.en.spec.ts');
const FR_SPEC_PATH = resolve(BILINGUAL_DIR, 'locale-smoke.fr.spec.ts');

const helper = readFileSync(HELPER_PATH, 'utf-8');
const enSpec = readFileSync(EN_SPEC_PATH, 'utf-8');
const frSpec = readFileSync(FR_SPEC_PATH, 'utf-8');

describe('Phase 0C.2 §13 bilingual smoke suite — source guard', () => {
  // #1 helper exports runBilingualSmokeSuite
  it('exports runBilingualSmokeSuite from _helpers.ts', () => {
    expect(helper).toMatch(
      /export\s+function\s+runBilingualSmokeSuite\s*\(\s*locale\s*:\s*BilingualLocale\s*\)\s*:\s*void\s*\{/,
    );
  });

  // #2 BilingualLocale is 'en-CA' | 'fr-CA'
  it('defines BilingualLocale type as "en-CA" | "fr-CA"', () => {
    expect(helper).toMatch(
      /export\s+type\s+BilingualLocale\s*=\s*'en-CA'\s*\|\s*'fr-CA'\s*;/,
    );
  });

  // #3 exactly seven test(...) calls (not counting test.describe / test.beforeAll)
  it('registers exactly SEVEN test(...) calls (one per §13 test area)', () => {
    // Match any `test(...)` call that is NOT `test.describe(` / `test.beforeAll(` etc.
    const testCallMatches = helper.match(/\btest\(\s*[`'"]/g) ?? [];
    expect(testCallMatches).toHaveLength(7);
  });

  // #4 beforeAll hook uses ensureServerReady
  it('registers test.beforeAll that calls ensureServerReady', () => {
    expect(helper).toMatch(
      /test\.beforeAll\(\s*async\s*\(\s*\{\s*request\s*\}\s*\)\s*=>\s*\{\s*[\s\S]{0,80}await\s+ensureServerReady\(\s*request\s*\)/,
    );
  });

  // #5a asserts <html lang> invariant (locale-templated string)
  it('asserts <html lang="${locale}"> invariant', () => {
    // helper builds the expected value dynamically: expect(htmlLang).toBe(locale);
    expect(helper).toMatch(/expect\(\s*htmlLang\s*\)\s*\.toBe\(\s*locale\s*\)/);
  });

  // #5b covers all four marketing routes: `/`, `/trust`, `/pricing`, `/story`
  it('covers the four canonical marketing routes (root, /trust, /pricing, /story)', () => {
    // Root homepage: `/${locale}` (no trailing route)
    expect(helper).toMatch(/page\.goto\(\s*`\/\$\{locale\}`/);
    // Named routes are appended as `/${locale}/<name>`
    expect(helper).toMatch(/page\.goto\(\s*`\/\$\{locale\}\/trust`/);
    expect(helper).toMatch(/page\.goto\(\s*`\/\$\{locale\}\/pricing`/);
    expect(helper).toMatch(/page\.goto\(\s*`\/\$\{locale\}\/story`/);
  });

  // #6 EN spec invokes runBilingualSmokeSuite('en-CA')
  it('locale-smoke.en.spec.ts invokes runBilingualSmokeSuite("en-CA")', () => {
    expect(enSpec).toMatch(/runBilingualSmokeSuite\(\s*['"]en-CA['"]\s*\)/);
    expect(enSpec).toMatch(/import\s*\{\s*runBilingualSmokeSuite\s*\}\s+from\s+['"]\.\/_helpers['"]/);
  });

  // #7 FR spec invokes runBilingualSmokeSuite('fr-CA')
  it('locale-smoke.fr.spec.ts invokes runBilingualSmokeSuite("fr-CA")', () => {
    expect(frSpec).toMatch(/runBilingualSmokeSuite\(\s*['"]fr-CA['"]\s*\)/);
    expect(frSpec).toMatch(/import\s*\{\s*runBilingualSmokeSuite\s*\}\s+from\s+['"]\.\/_helpers['"]/);
  });

  // #8 spec files do NOT contain their own ad-hoc test(...) calls
  it('spec files delegate all assertions to the helper (no ad-hoc tests)', () => {
    // Neither spec should contain a bare `test(` or `test.describe(` call.
    // The `runBilingualSmokeSuite` invocation is the ONLY executable statement.
    expect(enSpec).not.toMatch(/\btest\s*\(/);
    expect(enSpec).not.toMatch(/\btest\.describe\s*\(/);
    expect(frSpec).not.toMatch(/\btest\s*\(/);
    expect(frSpec).not.toMatch(/\btest\.describe\s*\(/);
  });
});

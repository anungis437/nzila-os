import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 0C.2 §14 — Accessibility smoke source guard
 *
 * Static-analysis regression guard locking the contract of
 * `apps/union-eyes/e2e/a11y/smoke.spec.ts`. Enforces the five-area
 * mandate and the structural WCAG invariants required by the
 * `accessibility` Playwright project wired in §8.
 *
 * Placement note: this file lives at `apps/union-eyes/tests/` (NOT
 * `apps/union-eyes/tests/e2e/`) because `apps/union-eyes/vitest.config.ts`
 * excludes `tests/e2e/**` and `e2e/**` from vitest discovery. Same
 * placement discipline as:
 *   - §12: apps/union-eyes/tests/e2e-helpers-timeout.test.ts
 *   - §13: apps/union-eyes/tests/bilingual-smoke.test.ts
 */

const HERE = __dirname;
const SPEC_PATH = resolve(HERE, '..', 'e2e', 'a11y', 'smoke.spec.ts');

function readSpec(): string {
  return readFileSync(SPEC_PATH, 'utf8');
}

describe('Phase 0C.2 §14 — a11y smoke spec contract', () => {
  it('spec file exists at e2e/a11y/smoke.spec.ts', () => {
    expect(() => readSpec()).not.toThrow();
    const contents = readSpec();
    expect(contents.length).toBeGreaterThan(0);
  });

  it('imports { expect, test } from @playwright/test', () => {
    const contents = readSpec();
    expect(contents).toMatch(/import\s*\{[^}]*\bexpect\b[^}]*\btest\b[^}]*\}\s*from\s*['"]@playwright\/test['"]/);
  });

  it('imports ensureServerReady from tests/e2e/_helpers (§12 warm-up contract)', () => {
    const contents = readSpec();
    expect(contents).toMatch(/import\s*\{\s*ensureServerReady\s*\}\s*from\s*['"]\.\.\/\.\.\/tests\/e2e\/_helpers['"]/);
  });

  it('registers exactly FIVE test(...) calls (matches §14 mandate)', () => {
    const contents = readSpec();
    // Match `test('...', ...)`, `test("...", ...)`, or `test(`...`, ...)`.
    // Excludes `test.describe`, `test.beforeAll`, `test.afterAll`, `test.setTimeout`, etc.
    const matches = contents.match(/(?<!\.)\btest\(\s*['"`]/g) ?? [];
    expect(matches.length, `expected 5 test(...) calls, found ${matches.length}`).toBe(5);
  });

  it('registers a test.beforeAll that awaits ensureServerReady(request)', () => {
    const contents = readSpec();
    expect(contents).toMatch(/test\.beforeAll\(\s*async\s*\(\s*\{\s*request\s*\}\s*\)\s*=>\s*\{[\s\S]*?await\s+ensureServerReady\(\s*request\s*\)[\s\S]*?\}\s*\)/);
  });

  it('declares the four canonical marketing routes constant', () => {
    const contents = readSpec();
    expect(contents).toMatch(/const\s+ROUTES\s*=\s*\[\s*['"]\/en-CA['"],\s*['"]\/en-CA\/trust['"],\s*['"]\/en-CA\/pricing['"],\s*['"]\/en-CA\/story['"]\s*\]/);
  });

  it('area #1: asserts <html lang> is set on every route', () => {
    const contents = readSpec();
    expect(contents).toMatch(/page\.locator\(\s*['"]html['"]\s*\)\.getAttribute\(\s*['"]lang['"]\s*\)/);
    expect(contents).toMatch(/expect\(\s*htmlLang[^)]*\)\.toBeTruthy\(\s*\)/);
  });

  it('area #2: asserts img:not([alt]) count is 0', () => {
    const contents = readSpec();
    expect(contents).toMatch(/page\.locator\(\s*['"]img:not\(\[alt\]\)['"]\s*\)\.count\(\s*\)/);
  });

  it('area #3: asserts exactly one <h1>', () => {
    const contents = readSpec();
    expect(contents).toMatch(/page\.locator\(\s*['"]h1['"]\s*\)\.count\(\s*\)/);
    expect(contents).toMatch(/expect\(\s*h1Count[^)]*\)[^;]*\.toBe\(\s*1\s*\)/);
  });

  it('area #4: asserts every visible <a href> has an accessible name', () => {
    const contents = readSpec();
    // Must exercise <a href> visibility and an accessible-name filter
    expect(contents).toMatch(/a\[href\]:visible/);
    expect(contents).toMatch(/aria-label/);
  });

  it('area #5: asserts every visible <button> has an accessible name', () => {
    const contents = readSpec();
    expect(contents).toMatch(/button:visible/);
  });

  it('all five WCAG anchors are documented in comments (3.1.1, 1.1.1, 2.4.6, 2.4.4, 4.1.2)', () => {
    const contents = readSpec();
    for (const anchor of ['3.1.1', '1.1.1', '2.4.6', '2.4.4', '4.1.2']) {
      expect(contents, `missing WCAG anchor: ${anchor}`).toContain(anchor);
    }
  });

  it('uses cold-session-safe routes only (no /dashboard, /admin, /sign-in flow)', () => {
    const contents = readSpec();
    // ROUTES constant must not include gated paths
    expect(contents).not.toMatch(/ROUTES\s*=[\s\S]*?['"]\/dashboard['"]/);
    expect(contents).not.toMatch(/ROUTES\s*=[\s\S]*?['"]\/admin['"]/);
  });
});

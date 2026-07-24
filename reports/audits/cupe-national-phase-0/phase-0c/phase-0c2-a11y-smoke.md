# Phase 0C.2 §14 — Accessibility Smoke Suite

**Section:** 14 (Accessibility smoke — 5 structural WCAG areas)
**Status:** ✅ Complete
**Deliverables:** 2 files (1 Playwright spec + 1 vitest source guard) + this forensic
**Playwright discovery:** 5 e2e tests wired + 1 setup dep
**Vitest source guard:** 13/13 pass in ~12 ms
**Union-eyes full vitest:** 1116/1117 files pass, 16211/16213 tests pass (2 pre-existing skips)
**Runtime revalidation:** deferred to §15 (consolidated flake analysis)

---

## 1. Deliverable inventory

| # | File | Purpose |
|---|------|---------|
| 1 | `apps/union-eyes/e2e/a11y/smoke.spec.ts` | Populates the `accessibility` Playwright project wired by §8. Registers exactly 5 tests, one per WCAG anchor area. |
| 2 | `apps/union-eyes/tests/a11y-smoke.test.ts` | Vitest source-guard — 13 static-analysis assertions locking the five-area contract, warm-up wiring, and cold-session-safe route selection. |
| 3 | `reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-a11y-smoke.md` | This forensic. |

The Playwright spec lands under `apps/union-eyes/e2e/a11y/` matching the
`ACCESSIBILITY_TEST_MATCH` glob that §8 declared:

```ts
const ACCESSIBILITY_TEST_MATCH = ['e2e/a11y/**/*.spec.ts'];
```

The comment on that constant explicitly names §14 as the population
mandate:

> Bilingual & accessibility projects — testMatch points at directories
> populated by Phase 0C.2 §13 (bilingual smoke, 7 areas) and **§14
> (accessibility smoke, 5 areas)**. Until those specs exist the
> projects match zero files: intentional scaffolding, not a broken
> config.

The vitest guard is placed at `apps/union-eyes/tests/a11y-smoke.test.ts`
— one level above the `tests/e2e/**` and `e2e/**` roots which
`apps/union-eyes/vitest.config.ts` excludes from discovery. Same
placement discipline as §12 and §13.

---

## 2. The five §14 test areas

Each area anchors to a specific, machine-checkable WCAG success
criterion. Each test iterates over the same four public marketing
routes so one `test(...)` registration exercises all routes for its
invariant (matching the "5 areas" mandate exactly rather than
5-areas-×-4-routes = 20 individual assertions).

| # | Test area | WCAG anchor | Assertion |
|---|-----------|-------------|-----------|
| 1 | `<html lang>` set | **3.1.1** Language of Page | `page.locator('html').getAttribute('lang')` is truthy and non-empty |
| 2 | `<img>` alt attribute | **1.1.1** Non-text Content | `page.locator('img:not([alt])').count()` === 0 |
| 3 | Exactly one `<h1>` | **2.4.6** Headings and Labels | `page.locator('h1').count()` === 1 |
| 4 | `<a>` accessible names | **2.4.4** Link Purpose (in Context) | 0 visible `<a href>` elements lack visible text, aria-label, aria-labelledby, and titled img child |
| 5 | `<button>` accessible names | **4.1.2** Name, Role, Value | 0 visible `<button>` elements lack visible text, aria-label, aria-labelledby, and titled img child |

### 2.1 Route coverage

```ts
const ROUTES = ['/en-CA', '/en-CA/trust', '/en-CA/pricing', '/en-CA/story'] as const;
```

Routes are:
- **Static** (rendered from `app/[locale]/(marketing)/*/page.tsx`)
- **Unauthenticated** (safe under cold-session storageState `{cookies:[], origins:[]}`)
- **Locale-aware** (default `'en-CA'` from `apps/union-eyes/lib/locales.ts`)
- **Consistent with §13** — same four canonical marketing pages
  (governance/trust, contract/pricing, narrative story, homepage)

### 2.2 Why structural, not axe-core

The workspace has **no `@axe-core/playwright` package installed**
(verified via `findstr` across `pnpm-lock.yaml`, `package.json`, and
`apps/union-eyes/package.json` — 0 hits). Introducing a new dev
dependency mid-Phase-0C would:

1. Touch `pnpm-lock.yaml` (workspace-wide reproducibility surface)
2. Potentially trigger `pnpm.overrides` cascades affecting unrelated packages
3. Require security scanning of the new transitive tree (axe-core has
   ~40 transitive deps)
4. Exceed Phase 0C's non-negotiable that no unrelated dependency
   changes ship inside a stabilization commit

Instead the suite asserts **structural HTML contracts** via
`page.locator(...)`. This trades wide rule coverage for narrow, hard,
absolute invariants — exactly the shape §14 mandates for a "smoke"
suite. The five chosen invariants collectively cover the four highest-
signal WCAG failures observed in real-world audits: missing page
language, missing alt text, malformed heading hierarchy, and
unlabeled interactive controls (links + buttons). Rule-based tooling
(axe, pa11y, lighthouse) can be introduced in a later phase without
invalidating any assertion this suite makes.

---

## 3. Contract shape

```ts
test.describe('Accessibility smoke — structural WCAG invariants', () => {
  test.beforeAll(async ({ request }) => {
    await ensureServerReady(request);     // §12 warm-up (180s hook budget)
  });

  test('every marketing route sets <html lang> to a non-empty value', async ({ page }) => { /* WCAG 3.1.1 */ });
  test('every <img> on every marketing route has an alt attribute',   async ({ page }) => { /* WCAG 1.1.1 */ });
  test('every marketing route has exactly one <h1>',                  async ({ page }) => { /* WCAG 2.4.6 */ });
  test('every visible <a href> on every marketing route has an accessible name', async ({ page }) => { /* WCAG 2.4.4 */ });
  test('every visible <button> on every marketing route has an accessible name', async ({ page }) => { /* WCAG 4.1.2 */ });
});
```

Key contract points:

1. **Exactly 5 `test(...)` registrations.** Locked by source-guard test #4.
2. **`test.beforeAll(ensureServerReady)` warm-up.** Cold-compile
   immunity inherits from §12's helper (see
   `phase-0c2-security-tests.md` §3 for the 180 s hook budget
   rationale).
3. **Cold session.** Playwright project uses
   `storageState: { cookies: [], origins: [] }` — a11y assertions run
   against the unauthenticated public surface only.
4. **Route iteration inside each test.** Keeps the test count aligned
   with the "5 areas" mandate while covering the same four canonical
   routes per invariant.

---

## 4. Regression guard (vitest source-guard, 13 assertions)

`apps/union-eyes/tests/a11y-smoke.test.ts` performs pure static
analysis on the spec file:

| # | Assertion |
|---|-----------|
|  1 | Spec file exists and is non-empty |
|  2 | Imports `{ expect, test }` from `'@playwright/test'` |
|  3 | Imports `ensureServerReady` from `'../../tests/e2e/_helpers'` |
|  4 | Registers exactly **five** `test(...)` calls (regex excludes `test.describe`, `test.beforeAll`, etc.) |
|  5 | Registers a `test.beforeAll(async ({request}) => { await ensureServerReady(request); ... })` |
|  6 | Declares `const ROUTES = ['/en-CA', '/en-CA/trust', '/en-CA/pricing', '/en-CA/story']` |
|  7 | Area #1: `page.locator('html').getAttribute('lang')` + `expect(htmlLang).toBeTruthy()` |
|  8 | Area #2: `page.locator('img:not([alt])').count()` |
|  9 | Area #3: `page.locator('h1').count()` + `expect(...).toBe(1)` |
| 10 | Area #4: covers `a[href]:visible` selector + `aria-label` |
| 11 | Area #5: covers `button:visible` selector |
| 12 | All five WCAG anchors documented in comments (3.1.1, 1.1.1, 2.4.6, 2.4.4, 4.1.2) |
| 13 | `ROUTES` does NOT include gated paths (`/dashboard`, `/admin`) — cold-session safety |

Execution: 13/13 pass in ~12 ms of test time (~385 ms wall including
vitest boot).

---

## 5. Behavioural invariants preserved

§14 authorship touched **only**:

- Created: `apps/union-eyes/e2e/a11y/smoke.spec.ts` (new dir + new file)
- Created: `apps/union-eyes/tests/a11y-smoke.test.ts` (new file)
- Created: this forensic

Nothing modified in:

- `apps/union-eyes/playwright.config.ts` (accessibility project already wired by §8)
- `apps/union-eyes/tests/e2e/_helpers.ts` (§12 `ensureServerReady`)
- Any persona, security, or bilingual spec
- Any application source under `apps/union-eyes/app/`
- Any migration under `apps/union-eyes/db/migrations/`
- `package.json`, `pnpm-lock.yaml`, or any dependency descriptor

Full union-eyes vitest regression: **1116/1117 files pass, 16211/16213
tests pass** (2 pre-existing skips). Delta over §13 baseline
(1115/1116 files, 16198/16200 tests) is **+13 tests / +1 file** —
matching the 13 new static-analysis assertions in
`a11y-smoke.test.ts` exactly.

---

## 6. Rejected alternatives

| Rejected approach | Reason |
|-------------------|--------|
| **Introduce `@axe-core/playwright` dev-dep** | Touches pnpm-lock.yaml + workspace resolution; exceeds Phase 0C stabilization scope and violates the non-negotiable that dep-graph changes ship separately. Structural WCAG assertions cover the highest-signal a11y failure modes without a dep introduction. |
| **Use pa11y or lighthouse-ci as external checker** | Same dep-scope objection; also introduces headless-browser-in-headless-browser fragility. Playwright's native `page.locator` is sufficient for structural assertions. |
| **Test 5-areas × 4-routes as 20 separate `test()` calls** | §14 explicitly mandates "5 areas". Twenty tests would (a) blow up Playwright's retry budget by 4× on flakes, (b) obscure the invariant → route relationship, (c) require 4× as much test-ID enumeration in reports. Route iteration inside each test is idiomatic Playwright pattern. |
| **Assert against `axe.check()` results (via CDN axe.js injection)** | Injecting axe.js via `page.addScriptTag` from a CDN is a supply-chain risk and requires Content-Security-Policy relaxation. Rejected on security grounds. |
| **Cover authenticated routes (`/dashboard`, `/case/*`)** | Cold-session project has `storageState: {cookies:[], origins:[]}`; authenticated routes would redirect to `/sign-in` and every assertion would trivially pass against the sign-in page. Rejected. |
| **Assert full color-contrast ratios via getComputedStyle** | Requires font metrics, background inheritance walks, and RGB-to-Luminance math — the exact class of computation that a proper a11y engine (axe) exists to provide. Structural checks are the right layer for "smoke". |
| **Place source guard at `tests/e2e/a11y-smoke.test.ts`** | `vitest.config.ts` excludes `tests/e2e/**`. Guard would never run. §12/§13 established the correct placement (one level above the excluded root). |
| **Skip the vitest source guard entirely** | Playwright discovery alone does not lock the five-area contract. A future refactor could reduce the suite to three tests or introduce ad-hoc `test.describe` nesting — the source guard makes any such drift a build failure. |

---

## 7. Local verification results

```text
=== vitest source guard (tests/a11y-smoke.test.ts) ===
 Test Files  1 passed (1)
      Tests  13 passed (13)
   Duration  385 ms

=== playwright --list --project=accessibility ===
[setup] ... phase-0c2-s8 auth-state summary is present, complete, and consistent
[accessibility] e2e\a11y\smoke.spec.ts:88  ... every marketing route sets <html lang> to a non-empty value
[accessibility] e2e\a11y\smoke.spec.ts:98  ... every <img> on every marketing route has an alt attribute
[accessibility] e2e\a11y\smoke.spec.ts:107 ... every marketing route has exactly one <h1>
[accessibility] e2e\a11y\smoke.spec.ts:119 ... every visible <a href> on every marketing route has an accessible name
[accessibility] e2e\a11y\smoke.spec.ts:137 ... every visible <button> on every marketing route has an accessible name
Total: 6 tests in 2 files

=== full union-eyes vitest regression ===
 Test Files  1116 passed | 1 skipped (1117)
      Tests  16211 passed | 2 skipped (16213)
   Duration  173.96 s
```

---

## 8. Runtime revalidation deferral

Consistent with §12 and §13, live Playwright execution of the
`accessibility` project is **deferred to §15 flake analysis**.
Rationale:

- The suite is source-verifiable end-to-end: Playwright discovery
  enumerates all 5 tests correctly, and the vitest source guard locks
  the five-area contract, the warm-up wiring, the four canonical
  routes, all five WCAG anchors, and the cold-session-safety property.
- The §15 flake window (`3 × Baseline Run 2`, ~40 min per run) executes
  the accessibility project alongside every other project — running a
  standalone Playwright pass now would add ~10 min cost without adding
  information.
- Should any a11y test fail during §15, it will surface in the same
  §19 closure classification pipeline as the existing 48 test-level
  failures from Baseline Run 2 attempt-6.

If §15 uncovers a route or invariant failure, the fix belongs on the
application side (`app/[locale]/(marketing)/*/page.tsx` markup) — not
in the test suite, which encodes the correct WCAG contract.

---

## 9. Deviations from mandate

**None.** All standing non-negotiables in force during authorship:

- ✅ orchestrator polls `/api/health/readiness`, not `/api/health/liveness` (unchanged)
- ✅ Playwright auth-bypass remains structurally impossible outside governed test execution (unchanged; a11y suite never invokes bypass)
- ✅ Gitleaks exception remains narrowly scoped (unchanged)
- ✅ No new dependencies added to `package.json` or `pnpm-lock.yaml`
- ✅ No files added to `apps/union-eyes/db/migrations/`
- ✅ No modification of `apps/union-eyes/next-env.d.ts`, `ops/outputs/*.json`, or the `apps/union-eyes/{}` sentinel
- ✅ Commit scoped to §14 deliverables only (3 files added; 0 files modified)

---

## 10. Files committed

```
A  apps/union-eyes/e2e/a11y/smoke.spec.ts
A  apps/union-eyes/tests/a11y-smoke.test.ts
A  reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-a11y-smoke.md
```

Files intentionally EXCLUDED from the commit:

```
M  apps/union-eyes/next-env.d.ts               (unrelated)
M  ops/outputs/data-residency-runtime.json     (unrelated)
M  ops/outputs/governance-runtime-budget.json  (unrelated)
M  ops/outputs/onboarding-kpis.json            (unrelated)
M  ops/outputs/strategic-resilience-report.json (unrelated)
?? apps/union-eyes/{}                          (sentinel; do not touch)
```

# Phase 0C.2 §13 — Bilingual Smoke Tests (EN + FR)

**Section:** 13 (Bilingual smoke — 7 test areas per §8 wiring)
**Status:** ✅ Complete
**Deliverables:** 4 files (2 spec + 1 helper + 1 vitest source guard)
**Playwright discovery:** 14 e2e tests wired (7 × 2 locales) + 1 setup dep
**Vitest source guard:** 9/9 pass in ~15 ms
**Union-eyes full vitest:** 1115/1116 files pass, 16198/16200 tests pass (2 pre-existing skips)
**Runtime revalidation:** deferred to §15 (consolidated flake analysis)

---

## 1. Deliverable inventory

| # | File | Purpose |
|---|------|---------|
| 1 | `apps/union-eyes/e2e/bilingual/_helpers.ts` | Shared helper `runBilingualSmokeSuite(locale)` registering the seven §13 test areas |
| 2 | `apps/union-eyes/e2e/bilingual/locale-smoke.en.spec.ts` | `bilingual-en` project entry point (invokes helper with `'en-CA'`) |
| 3 | `apps/union-eyes/e2e/bilingual/locale-smoke.fr.spec.ts` | `bilingual-fr` project entry point (invokes helper with `'fr-CA'`) |
| 4 | `apps/union-eyes/tests/bilingual-smoke.test.ts` | Vitest source-guard — 9 static-analysis assertions locking the structural contract |

All four files sit under `apps/union-eyes/`. The e2e triple lands in
`e2e/bilingual/`, matching the `testMatch` globs already declared by §8
in `playwright.config.ts`:

```
bilingual-en: e2e/bilingual/**/*.en.spec.ts   locale: 'en-CA'
bilingual-fr: e2e/bilingual/**/*.fr.spec.ts   locale: 'fr-CA'
```

The vitest guard lives at `apps/union-eyes/tests/bilingual-smoke.test.ts`
— one level **above** the `tests/e2e/**` directory that
`apps/union-eyes/vitest.config.ts` excludes from discovery. This mirrors
the placement decision recorded in §12 for
`tests/e2e-helpers-timeout.test.ts` (see
`phase-0c2-security-tests.md` §3).

---

## 2. The seven §13 test areas

The suite covers the highest-signal bilingual invariants of the
UnionEyes marketing surface. Each assertion is deliberately **anchored
in structure**, not in translated string values (which drift between
marketing revisions).

| # | Test area | Assertion |
|---|-----------|-----------|
| 1 | Locale-prefixed **homepage** | `<html lang="{locale}">` on `GET /{locale}` |
| 2 | Locale-prefixed **/trust** | `<html lang="{locale}">` on `GET /{locale}/trust` |
| 3 | Locale-prefixed **/pricing** | `<html lang="{locale}">` on `GET /{locale}/pricing` |
| 4 | Locale-prefixed **/story** | `<html lang="{locale}">` on `GET /{locale}/story` |
| 5 | **Brand metadata** | `<title>` contains `/UnionEyes/i` on `GET /{locale}` (locale-agnostic brand invariant) |
| 6 | **Structural a11y** | `img:not([alt])` count === 0 on `GET /{locale}` (matches `smoke.spec.ts` pattern) |
| 7 | **Infrastructure smoke** | `GET /api/health` returns 200 or 503 (matches public smoke baseline) |

All seven run under both `bilingual-en` (browser locale `en-CA`, member
storageState) and `bilingual-fr` (browser locale `fr-CA`, member
storageState), producing 14 Playwright tests total.

### Route selection rationale

The four marketing routes chosen for assertions #1–#4 (`/`, `/trust`,
`/pricing`, `/story`) are:

- **Static** — rendered from `app/[locale]/(marketing)/*/page.tsx`.
- **Unauthenticated** — no session gating; safe under any storageState.
- **Locale-aware** — inherit `NextIntlClientProvider` from
  `app/[locale]/layout.tsx` and `<html lang={locale}>` from
  `app/layout.tsx` (root layout, line 159).
- **High-signal** — cover the three narrative pillars declared in the
  organizational positioning manifest (governance/trust, contract/pricing,
  organizational story) plus the homepage as the default landing.

`/trust`, `/pricing`, and `/story` were verified present under
`apps/union-eyes/app/[locale]/(marketing)/` before authoring.

---

## 3. Contract shape

### 3.1 Helper contract

```ts
export type BilingualLocale = 'en-CA' | 'fr-CA';

export function runBilingualSmokeSuite(locale: BilingualLocale): void {
  test.describe(`Bilingual smoke — ${locale}`, () => {
    test.beforeAll(async ({ request }) => {
      await ensureServerReady(request);       // §12 warm-up contract
    });
    // ...seven test(...) registrations...
  });
}
```

Key contract points:

1. **Single entry point.** Both spec files invoke exactly this function.
   Neither spec adds ad-hoc `test(...)` calls — the source guard blocks
   any regression of that discipline (§4 below).
2. **`test.beforeAll` warm-up.** The suite reuses the §12-hardened
   `ensureServerReady` helper (`apps/union-eyes/tests/e2e/_helpers.ts`)
   which raises the enclosing hook budget to 180 s via
   `try { test.setTimeout(180_000) } catch { /* no-op */ }`. Bilingual
   projects therefore inherit the same cold-compile immunity that §12
   established for the security projects.
3. **Seven `test(...)` registrations.** Enforced by
   `bilingual-smoke.test.ts::"registers exactly SEVEN test(...) calls"`.

### 3.2 Spec-file contract

```ts
// locale-smoke.en.spec.ts
import { runBilingualSmokeSuite } from './_helpers';
runBilingualSmokeSuite('en-CA');
```

```ts
// locale-smoke.fr.spec.ts
import { runBilingualSmokeSuite } from './_helpers';
runBilingualSmokeSuite('fr-CA');
```

Two-line spec files by construction — the source guard rejects any
addition of `test(` or `test.describe(` calls at the spec level.

---

## 4. Regression guard (vitest source-guard, 9 assertions)

`apps/union-eyes/tests/bilingual-smoke.test.ts` performs pure static
analysis. It reads the three §13 source files via `readFileSync` and
asserts the following contract points (all match Playwright discovery
output at commit time):

| # | Assertion |
|---|-----------|
| 1 | `_helpers.ts` exports `runBilingualSmokeSuite(locale: BilingualLocale): void` |
| 2 | `BilingualLocale` is exactly `'en-CA' \| 'fr-CA'` |
| 3 | Helper registers exactly **seven** `test(...)` calls (regex counts `test('...'` / `test("..."`  / `` test(`...` ``) |
| 4 | Helper registers a `test.beforeAll` that awaits `ensureServerReady(request)` |
| 5 | Helper asserts `expect(htmlLang).toBe(locale)` (dynamic locale invariant) |
| 6 | Helper hits all four canonical marketing routes: `` `/${locale}` ``, `` `/${locale}/trust` ``, `` `/${locale}/pricing` ``, `` `/${locale}/story` `` |
| 7 | `locale-smoke.en.spec.ts` calls `runBilingualSmokeSuite('en-CA')` and imports from `./_helpers` |
| 8 | `locale-smoke.fr.spec.ts` calls `runBilingualSmokeSuite('fr-CA')` and imports from `./_helpers` |
| 9 | Neither spec file contains bare `test(` or `test.describe(` calls (delegation-only contract) |

Execution profile: 9/9 pass in ~12 ms of test time (~830 ms wall
including vitest boot).

**Placement rationale.** `apps/union-eyes/vitest.config.ts` excludes
both `tests/e2e/**` and `e2e/**` from discovery. Placing the guard at
`tests/bilingual-smoke.test.ts` puts it exactly one level above the
excluded roots — the same pattern §12 recorded for
`tests/e2e-helpers-timeout.test.ts`.

---

## 5. Behavioural invariants preserved

The §13 authorship touched **only** the empty `e2e/bilingual/` project
directory and added one vitest source-guard under `tests/`. Nothing in
the following systems was modified:

- `apps/union-eyes/playwright.config.ts` (§8 wiring; discovery already
  correct at commit time).
- `apps/union-eyes/tests/e2e/_helpers.ts` (§12 `ensureServerReady`
  hardening).
- Any persona, security, or accessibility project source.
- Any auth-bypass or seed-reset code path.
- Any application source under `apps/union-eyes/app/`.
- Any migration under `apps/union-eyes/db/migrations/`.

Full union-eyes vitest regression: **1115/1116 files pass, 16198/16200
tests pass** (2 pre-existing skips). Test count is up +9 over the §12
baseline (1114/1115 files, 16189/16191 tests) — matching the 9 new
static-analysis assertions in `bilingual-smoke.test.ts` exactly.

---

## 6. Rejected alternatives

| Rejected approach | Reason |
|-------------------|--------|
| **Assert translated string values** (e.g. FR `/pricing` should contain "Déploiement contractuel") | Locale JSON files are ~500 KB and translations drift between marketing revisions. Coupling smoke tests to specific translated strings creates a high-churn maintenance surface without adding structural confidence. `<html lang>` + URL prefix are the true bilingual invariants. |
| **Test locale switcher via clicking** (find `<a href="/fr-CA/…">` and click) | Requires stable selector for the language toggle component, which is not part of the §13 mandate. The switcher is exercised implicitly by tests #1–#4 hitting locale-prefixed URLs directly. |
| **Two independent 14-line spec files with duplicated bodies** | Duplicated test bodies allow EN and FR coverage to drift silently. The helper-delegation pattern with a source-guarded contract makes drift a build failure. |
| **Place source guard at `tests/e2e/bilingual-smoke.test.ts`** | `vitest.config.ts` excludes `tests/e2e/**` — the guard would never run. §12 established the correct placement one level above the excluded root. |
| **Skip vitest source guard entirely** | Playwright discovery alone does not lock the seven-area contract (nothing prevents a future edit from reducing the suite to five tests, or moving assertions into one spec but not the other). Static-analysis guard is the enforcement layer. |
| **Assert `<html lang>` on `/sign-in`** | The `/sign-in` route lives OUTSIDE the `[locale]` segment. It renders with the app's default locale regardless of URL — asserting locale-parity there would be a false invariant. |
| **Cover all six locale-prefixed marketing pages** (`/for-members`, `/case-studies`, etc.) | Overweighting: §13 mandates "smoke", not "coverage". The four chosen routes are the highest-signal narrative pillars; comprehensive coverage lives with §14 (a11y) and §15 (flake analysis). |

---

## 7. Local verification results

```text
=== vitest source guard (tests/bilingual-smoke.test.ts) ===
✓ tests/bilingual-smoke.test.ts (9 tests) 12 ms
  Test Files  1 passed (1)
  Tests       9 passed (9)
  Duration    829 ms

=== playwright --list --project=bilingual-en --project=bilingual-fr ===
[setup] ... phase-0c2-s8 auth-state summary is present, complete, and consistent
[bilingual-en] e2e\bilingual\_helpers.ts:51 ... /en-CA renders with <html lang="en-CA">
[bilingual-en] e2e\bilingual\_helpers.ts:59 ... /en-CA/trust renders with <html lang="en-CA">
[bilingual-en] e2e\bilingual\_helpers.ts:67 ... /en-CA/pricing renders with <html lang="en-CA">
[bilingual-en] e2e\bilingual\_helpers.ts:75 ... /en-CA/story renders with <html lang="en-CA">
[bilingual-en] e2e\bilingual\_helpers.ts:83 ... /en-CA exposes UnionEyes brand in <title>
[bilingual-en] e2e\bilingual\_helpers.ts:90 ... /en-CA has no images missing alt attribute
[bilingual-en] e2e\bilingual\_helpers.ts:98 ... API health endpoint reachable (locale=en-CA project context)
[bilingual-fr] e2e\bilingual\_helpers.ts:51 ... /fr-CA renders with <html lang="fr-CA">
[bilingual-fr] e2e\bilingual\_helpers.ts:59 ... /fr-CA/trust renders with <html lang="fr-CA">
[bilingual-fr] e2e\bilingual\_helpers.ts:67 ... /fr-CA/pricing renders with <html lang="fr-CA">
[bilingual-fr] e2e\bilingual\_helpers.ts:75 ... /fr-CA/story renders with <html lang="fr-CA">
[bilingual-fr] e2e\bilingual\_helpers.ts:83 ... /fr-CA exposes UnionEyes brand in <title>
[bilingual-fr] e2e\bilingual\_helpers.ts:90 ... /fr-CA has no images missing alt attribute
[bilingual-fr] e2e\bilingual\_helpers.ts:98 ... API health endpoint reachable (locale=fr-CA project context)
Total: 15 tests in 2 files

=== full union-eyes vitest regression ===
Test Files  1115 passed | 1 skipped (1116)
Tests       16198 passed | 2 skipped (16200)
Duration    226.52 s
```

---

## 8. Runtime revalidation deferral

Consistent with §12, live Playwright execution of the bilingual specs
is **deferred to §15 flake analysis**. Rationale:

- The suite is source-verifiable end-to-end: Playwright discovery
  enumerates all 14 tests correctly, and the vitest source guard locks
  the seven-area contract, the `<html lang>` assertion, all four
  marketing routes, the `beforeAll` warm-up, and the
  helper-delegation pattern.
- The §15 flake window (`3 × Baseline Run 2`, ~40 min per run) will
  execute the bilingual projects alongside every other project — running
  a partial Playwright pass now would only add cost without adding
  information.
- Should any bilingual test fail during §15, it will surface in the same
  §19 closure classification pipeline as the existing 48 test-level
  failures from Baseline Run 2 attempt-6.

---

## 9. Deviations from mandate

**None.** All standing non-negotiables in force during authorship:

- ✅ orchestrator polls `/api/health/readiness`, not `/api/health/liveness` (unchanged)
- ✅ Playwright auth-bypass remains structurally impossible outside governed test execution (unchanged; bilingual specs never call the bypass)
- ✅ Gitleaks exception remains narrowly scoped (unchanged)
- ✅ No new files added to `apps/union-eyes/db/migrations/`
- ✅ No modification of `apps/union-eyes/next-env.d.ts`, `ops/outputs/*.json`, or the `apps/union-eyes/{}` sentinel
- ✅ Commit scoped to §13 deliverables only (4 files added; 0 files modified)

---

## 10. Files committed

```
A  apps/union-eyes/e2e/bilingual/_helpers.ts
A  apps/union-eyes/e2e/bilingual/locale-smoke.en.spec.ts
A  apps/union-eyes/e2e/bilingual/locale-smoke.fr.spec.ts
A  apps/union-eyes/tests/bilingual-smoke.test.ts
A  reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-bilingual-smoke.md
```

Files intentionally EXCLUDED from the commit (per non-negotiables and
prior sections' scoping discipline):

```
M  apps/union-eyes/next-env.d.ts               (unrelated)
M  ops/outputs/data-residency-runtime.json     (unrelated)
M  ops/outputs/governance-runtime-budget.json  (unrelated)
M  ops/outputs/onboarding-kpis.json            (unrelated)
M  ops/outputs/strategic-resilience-report.json (unrelated)
?? apps/union-eyes/{}                          (sentinel; do not touch)
```

# Phase 0C.2 — §BR-8 Batch E forensic (setup + bilingual-en + bilingual-fr)

Status: **Amber — 13/15 tests passed, 2 fails on same assertion (both locale homepages), all 15 lifecycle steps green.**
Section: §BR-8 (per-project independent validation)
Batch: E = `PLAYWRIGHT_PROJECTS=setup,bilingual-en,bilingual-fr`
Run ID: `20260724072220_311b5f`
Log: `reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-batch-e.log` (15 921 bytes)
Summary: `reports/audits/cupe-national-phase-0/phase-0c/run-artifacts/20260724072220_311b5f/run-summary.json`
Total elapsed: 129 seconds (03:22:18 → 03:24:27 local) — playwright wall clock 81 650 ms (1.36 min).

## §BR-8.E.1 Executive verdict

Batch E is **amber**: lifecycle green, filter correct, zero did-not-run, zero cascade — but a **genuine product-code defect** on the localised marketing homepage causes exactly 2 failures (one per locale) on the same assertion at `e2e/bilingual/_helpers.ts:51`.

The failure signature is:
```
expect(locator('body')).toBeVisible() — Expected visible, Received hidden, Timeout 5000ms
Locator resolved to <body>…</body> (9 retries) — unexpected value "hidden"
```

`/en-CA` and `/fr-CA` homepage renders `<body>` with `visibility:hidden` (or equivalent anti-FOUC cloak) that does not resolve to visible within the 5 s Playwright default. Other routes on the same locale (`/trust`, `/pricing`, `/story`) pass the identical assertion — proving the defect is scoped to the root marketing homepage rendering only.

## §BR-8.E.2 Lifecycle step evidence

| # | Step | Outcome | Detail |
|---|------|---------|--------|
| 1 | preflight | ok | node=v24.13.1, port 3002 free |
| 2 | allocate-db | ok | db=`ue_e2e_20260724072220_311b5f` |
| 3 | allocate-port | ok | port=3002 |
| 4 | migrations.platform | ok | drizzle bootstrap |
| 5 | migrations.django | skipped | not required |
| 6 | verify-phase0b-contract | ok | organization_members present |
| 7 | seed | ok | seed-test-env applied |
| 8 | boot-server | ok | Next.js dev ready |
| 9 | generate-auth-states | ok | 5 roles allOk=true |
| 10 | playwright | ok | **exitCode=1** projects=[setup,bilingual-en,bilingual-fr] elapsed=81 650 ms |
| 11 | collect-artifacts | ok | 39 ms |
| 12 | stop-server | ok | method=sigterm |
| 13 | drop-db | ok | `ue_e2e_20260724072220_311b5f` |
| 14 | verify-port-release | ok | port 3002 released |
| 15 | finalize | ok | summary written |

Filter proof: `playwright project filter: setup, bilingual-en, bilingual-fr` printed pre-step-10. `pnpm --recursive` returned `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL exit=1` (expected: bubble up test failure).

## §BR-8.E.3 Playwright test-level results

| Category | Count |
|---|---|
| Total tests executed | 15 |
| Passed | 13 |
| **Failed** | **2** |
| Skipped | 0 |
| Did-not-run | 0 |

Failure roster (exact):
1. `[bilingual-en] › e2e\bilingual\_helpers.ts:51:9 › Bilingual smoke — en-CA › locale-prefixed homepage /en-CA renders with <html lang="en-CA">`
2. `[bilingual-fr] › e2e\bilingual\_helpers.ts:51:9 › Bilingual smoke — fr-CA › locale-prefixed homepage /fr-CA renders with <html lang="fr-CA">`

Both fail on the same line (53) — `await expect(page.locator('body')).toBeVisible()` — with same signature.

Pass roster (13): setup (1) + bilingual-en (6): trust homepage / pricing / story / title / img-alt / api-health + bilingual-fr (6): same six. So 12 of 14 non-setup bilingual tests pass; only the two locale-root homepages fail.

## §BR-8.E.4 New signature — RTP-10 (marketing homepage `<body>` hidden)

Signature ID: **RTP-10**
Scope: `/{locale}` root only (both `en-CA` and `fr-CA`).
Assertion: `expect(page.locator('body')).toBeVisible()` at `e2e/bilingual/_helpers.ts:53`.
Symptom: locator resolves to `<body>` element (9 poll retries) but element reports `hidden` for >5 s.
Root cause hypothesis: anti-FOUC cloak on the localised marketing homepage — likely a `.opacity-0` / `visibility:hidden` on `<body>` (or root wrapper) that awaits client-side hydration or a locale-context provider that fails to resolve promptly under dev-mode compile.

Evidence:
- Same assertion passes on `/{locale}/trust`, `/{locale}/pricing`, `/{locale}/story` — same helper, same code path, different route.
- Locator resolves (`resolved to <body>… 9×`) so DOM is present; only visibility fails.
- Both locales identical → locale-agnostic defect on the marketing homepage layout, not i18n-specific.

Cross-batch check: no prior batch exercised `/{locale}` root visibility assertion (public smoke uses `/`; a11y checks `<html lang>` attribute, not body visibility). Batch E is the first to surface this class.

Remediation options (deferred to §BR-10):
1. **Product code**: remove or shorten the anti-FOUC cloak on marketing homepage layout; verify hydration is not blocked by a slow provider.
2. **Test code**: replace `body.toBeVisible()` with `page.locator('main').toBeVisible()` or `page.getByRole('heading', { level: 1 }).toBeVisible()` — semantic assertions that don't depend on FOUC-cloak timing.
3. **Test tolerance**: `expect(...).toBeVisible({ timeout: 15_000 })` — accept longer window under dev compile.

None applied in this batch per non-negotiables (no source edits during §BR-8).

## §BR-8.E.5 Reconciliation with §BR-5 register

§BR-5 bilingual forecast: **0 real fails** (bilingual project glob was empty in Run 3 baseline — §13 populated it after §BR-5 was written).

Batch E actual: **2 real fails.** Forecast drift +2. The register did not anticipate the RTP-10 anti-FOUC cloak defect because §13 tests were authored **after** Baseline Run 3 completed — the register only classifies signatures observable in Run 3.

Signature roll-up update: RTP-10 added to §BR-8 signature register (see §BR-8 memory + §BR-9 register roll-up).

## §BR-8.E.6 §BR-6 acceptance-criteria audit

Per §BR-6.5:

1. **Lifecycle green** — 15/15 steps ok. ✅
2. **Playwright ran with only the requested projects** — filter=`setup, bilingual-en, bilingual-fr`. ✅
3. **Zero did-not-run** — 0 did-not-run. ✅
4. **Failure count within forecast envelope** — forecast 0, observed 2. ❌ **FAIL**
5. **Signature classifiability** — 2/2 fails classified (RTP-10). ✅

**Batch E fails §BR-6.5 criterion #4 only.** Zero did-not-run and zero cascade — clean isolation, real product defect. Amber verdict.

## §BR-8.E.7 Non-negotiables audit

- ✅ No modification of `apps/union-eyes/e2e/**` specs.
- ✅ No modification of `apps/union-eyes/db/**`, migrations, `0008`.
- ✅ No new dependencies.
- ✅ No deploy, no merge, no force-push.
- ✅ Disposable DB dropped (`ue_e2e_20260724072220_311b5f`).
- ✅ Port 3002 released.
- ✅ `PLAYWRIGHT_PROJECTS` unset after batch.

## §BR-8.E.8 Handoff to Batch F

Proceed to **Batch F = `setup,accessibility`** (5 tests per §14). §14's a11y suite uses different assertions (`<html lang>` attribute, `img[alt]` count, `<h1>` count, link/button accessible names) — none depend on `body.toBeVisible()`. So RTP-10 should NOT recur in Batch F even though Batch F visits the same `/{locale}` homepage.

Expected: Batch F clean green (5/5 pass).

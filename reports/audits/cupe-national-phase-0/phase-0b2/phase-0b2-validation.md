# Phase 0B.2 §17 — Validation Evidence

Branch: `fix/union-eyes-phase0b-clean` @ 4d6f63511 (working)
Worktree: `C:\APPS\nzila-automation-phase0b-clean`
Node: v24.13.1  •  pnpm: 10.33.0  •  vitest: 4.1.2

## Gate matrix

| # | Gate                                             | Result | Notes                                                                                        |
|---|--------------------------------------------------|--------|----------------------------------------------------------------------------------------------|
| 1 | Ownership manifest validator                     | PASS   | 125 tables classified, 0 OWNERSHIP_UNRESOLVED (from §16)                                     |
| 2 | Typecheck — `packages/platform-org-resolver`     | PASS   | `tsc --noEmit` clean                                                                          |
| 3 | Typecheck — `packages/ue-cognition`              | PASS   | `tsc --noEmit` clean                                                                          |
| 4 | Typecheck — `apps/union-eyes`                    | PASS   | Requires `NODE_OPTIONS=--max-old-space-size=8192` (4 GB heap OOMs)                            |
| 5 | `pnpm validate:docs`                             | PASS   | 0 errors, 1224 warnings (non-blocking; pre-existing doc drift)                                |
| 6 | `pnpm governance:audit`                          | PASS   | EXIT=0. Includes: lint 0 errors / 324 warnings; `check-ue-db-import-guard` clean (0 violations); financial-service health 28 files / 541 tests PASS |
| 7 | `pnpm test:fast` (scoped: 3 projects — see below)| PASS   | 1978 files passed / 2 skipped; 27,775 tests passed / 24 skipped; 0 failures; 297.40 s        |

Scoped projects for gate 7:
- `platform-org-resolver` (Phase 0B.2 §11)
- `ue-cognition`          (Phase 0B.2 §12)
- `union-eyes`            (covers `lib/organizations/platform-tenant.ts` from §13)

Scope justification: Phase 0B.2 touches (a) the resolver package, (b) UE Cognition schema/text-id promotion,
and (c) the DB-adapter reconstructed into `apps/union-eyes`. No other workspace project is functionally
affected. Running the full 260-project suite is not a §17 gate.

## Sub-fix landed in this section

`packages/cupe-vocabulary/package.json` — `exports`, `main`, `types` pointed at `./dist/index.js` /
`./dist/types.js`, but the package has no `dist/` (never built and no prebuild hook wired). Vitest was
therefore unable to resolve `@nzila/cupe-vocabulary` when any consumer test file imported it, producing
22 spurious failures across 6 files in `apps/union-eyes/app/api/__tests__`. This is a pre-existing repo
issue unrelated to Phase 0B.2 (no §1–§16 file touches cupe-vocabulary or a route that imports it).

Applied the direct-source convention already used by `@nzila/ue-cognition`, `@nzila/platform-org-resolver`,
and other TypeScript-source workspace packages:

```jsonc
"type": "module",
"exports": {
  ".": "./src/index.ts",
  "./types": "./src/types.ts"
},
"main": "./src/index.ts",
"types": "./src/index.ts"
```

Verification: `apps/union-eyes/app/api/__tests__/cases-intake.route.test.ts` → 7/7 PASS in 1.40 s.
Then full scoped test:fast → 0 failures (see gate 7).

This fix is bundled into the Phase 0B.2 evidence commit (§19) and disclosed here to keep the PR history
honest — landing an unrelated one-line side-fix is preferable to skipping a CI failure (per repo hygiene
policy: "always fix unrelated CI failures encountered on a PR").

## Reproduction

```powershell
cd C:\APPS\nzila-automation-phase0b-clean
$env:NODE_OPTIONS = "--max-old-space-size=8192"

# Typecheck (packages)
pnpm --filter @nzila/platform-org-resolver exec tsc --noEmit
pnpm --filter @nzila/ue-cognition           exec tsc --noEmit
pnpm --filter union-eyes                    exec tsc --noEmit

# Docs
pnpm validate:docs

# Governance (lint + doc consistency + financial-service health + UE db-import guard)
pnpm governance:audit

# Tests (scoped)
pnpm test:fast --project=platform-org-resolver --project=ue-cognition --project=union-eyes
```

## Result

All §17 gates PASS. Phase 0B.2 validation complete; proceeding to §18 evidence bundle.

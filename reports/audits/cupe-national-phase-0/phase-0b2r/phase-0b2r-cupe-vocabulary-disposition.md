# Phase 0B.2R §12 — cupe-vocabulary Side-Fix Disposition

**Status:** AMBER — FOUNDATIONAL RUNTIME INTEGRATION INCOMPLETE
**Section:** 12 (Disposition of the `packages/cupe-vocabulary/package.json`
side-fix embedded in Phase 0B.2 commit `7d29759c6`)
**Date:** 2026-07-23 (America/New_York)
**Branch:** `fix/union-eyes-phase0b-clean`
**Working tree:** `C:\APPS\nzila-automation-phase0b-clean`
**Prior commit:** `39d5e5e62` (§11 existing-DB upgrade + runtime proof)

---

## 1. Purpose

Aubert's downgrade note lists as a secondary concern:

> `packages/cupe-vocabulary/package.json` side-fix embedded in Phase 0B.2
> deployable branch without necessity decision.

The change was scope-adjacent to Phase 0B.2 (governed hybrid closure) and
landed in commit `7d29759c6` alongside drivers, evidence bundle, and
regenerated governance artifacts. This section records the necessity
decision, evidence, and recommended disposition.

Per the standing mandate: "Do not merge. Do not force-push." — this
section only records the decision. The change stays on
`fix/union-eyes-phase0b-clean` in place; nothing is reverted or
rewritten.

## 2. Mandate quotes (verbatim)

- "Always fix unrelated CI failures encountered on a PR — never skip them
  even if not caused by our changes." (repo policy stored in user memory)
- "Do not introduce a new architecture." — this change does not.
- "Keep edits scoped to the requested change." — this change is a
  disclosed side-fix; §12 exists specifically to close that scope
  question.

## 3. What the side-fix actually did

Commit `7d29759c6` diff on `packages/cupe-vocabulary/package.json`
(6 lines changed):

```diff
   "exports": {
-    ".": {
-      "import": "./dist/index.js",
-      "types": "./dist/index.d.ts"
-    },
-    "./types": {
-      "import": "./dist/types.js",
-      "types": "./dist/types.d.ts"
-    }
+    ".": "./src/index.ts",
+    "./types": "./src/types.ts"
   },
-  "main": "./dist/index.js",
-  "types": "./dist/index.d.ts",
+  "main": "./src/index.ts",
+  "types": "./src/index.ts",
```

The pre-fix state pointed `exports`/`main`/`types` at `./dist/*.js`
files that **did not exist**: the package has no build step producing
`dist/` — verified today (`Test-Path packages/cupe-vocabulary/dist ->
False`). The post-fix state points at `./src/*.ts` directly.

## 4. Necessity analysis

### 4.1 Non-existence of `dist/`

```
> Test-Path packages/cupe-vocabulary/src/index.ts   -> True
> Test-Path packages/cupe-vocabulary/src/types.ts   -> True
> Test-Path packages/cupe-vocabulary/dist            -> False
```

No `dist/` folder exists at HEAD and none is produced by a build step
in this package's `scripts` field (`build` = `tsc` — but no build has
been checked in, and Turborepo does not compile ambient TS source
packages for consumers).

### 4.2 Consumer impact

`@nzila/cupe-vocabulary` is imported by production code:

```
apps/union-eyes/package.json:                "@nzila/cupe-vocabulary": "workspace:*"
apps/union-eyes/lib/case-fsm-enforcement.ts: import { ... } from '@nzila/cupe-vocabulary';
```

`case-fsm-enforcement.ts` bridges cupe-vocabulary statuses with the
union-eyes enforcement rules — a first-class dependency, not test-only.
With the pre-fix `main`/`exports` pointing at non-existent `dist/`
files, this import chain resolves incorrectly under Node ESM lookup
(the `exports` map short-circuits before falling back to the `src/`
tree), which is exactly the failure the Phase 0B.2 §17 validation
observed as 22 spurious `test:fast` failures.

### 4.3 Convention conformance

Cross-checked all `packages/**/package.json` (~150 packages).
`./src/index.ts` is the workspace's TS-source convention:

- **~148 packages** use `./src/index.ts` for `main` (direct-source, no
  build step)
- **2 packages** currently retain `./dist/index.js`
  (`@nzila/canadian-vocabulary`, `@nzila/platform-jurisdiction-compliance`)
  — both are pre-existing repo-hygiene items unrelated to Phase 0B.2R

The Phase 0B.2 side-fix moved `@nzila/cupe-vocabulary` from the
minority (broken) shape into the majority (working) shape. Post-fix,
the package matches the exact pattern used by peers such as
`@nzila/platform-auth`, `@nzila/db`, `@nzila/contracts`, etc.

### 4.4 Alternative considered

Alternative: leave `./dist/*.js` in place and add a build step
(`tsc` producing `dist/`). Rejected during Phase 0B.2 §17 for scope
reasons (would require: `pnpm build` gate additions, Turborepo pipeline
edits, and would diverge from the TS-source convention used elsewhere).
Rejected again here for the same reasons, plus: nothing consumed the
change from Phase 0B.2 forward has depended on a compiled `dist/`.

## 5. Disposition

**JUSTIFIED — KEEP IN PLACE.**

1. The fix is technically necessary — pre-fix `exports`/`main` pointed
   at non-existent files and produced 22 verified `test:fast` failures
   in `pnpm test:fast` runs during Phase 0B.2 §17.
2. The fix is convention-compliant — ~148 sibling packages use the
   same shape.
3. The fix is minimal — single file, 6-line diff, no code changes.
4. The fix is disclosed — Phase 0B.2 commit body explicitly names it
   as a "Scope-adjacent side-fix (disclosed in
   phase-0b2-validation.md and phase-0b2-closure.md)".
5. Reverting would reintroduce the 22 broken tests and break the
   `case-fsm-enforcement.ts` import chain in production union-eyes.

The scope-purity concern raised by the downgrade note is answered by
this record: the side-fix was necessary CI hygiene per the standing
repo policy ("Always fix unrelated CI failures encountered on a PR —
never skip them even if not caused by our changes") and Phase 0B.2 was
the operationally-correct commit boundary because the failure was
first observed there.

## 6. What this section does NOT do

- Does not modify `packages/cupe-vocabulary/package.json` in any way.
- Does not touch the two remaining `./dist/*.js` packages
  (`@nzila/canadian-vocabulary`, `@nzila/platform-jurisdiction-compliance`)
  — out of Phase 0B.2R scope; those are pre-existing hygiene items.
- Does not add a build step for `@nzila/cupe-vocabulary`.
- Does not attempt to retroactively split the Phase 0B.2 commit
  `7d29759c6` — the mandate forbids rewriting pushed history.

## 7. Files touched by this section

| File | Change |
| ---- | ------ |
| [`reports/audits/cupe-national-phase-0/phase-0b2r/phase-0b2r-cupe-vocabulary-disposition.md`](phase-0b2r-cupe-vocabulary-disposition.md) | NEW — this file |

## 8. Cross-references

- Phase 0B.2 commit that introduced the fix: `7d29759c6`
- Phase 0B.2 validation record: `../phase-0b2/phase-0b2-validation.md`
  (Section referencing 22 test:fast failures)
- Phase 0B.2 closure record: `../phase-0b2/phase-0b2-closure.md`
- Companion §11 proof:
  [phase-0b2r-upgrade-runtime-proof.md](phase-0b2r-upgrade-runtime-proof.md)
- Companion §10 proof:
  [phase-0b2r-compose-runtime-proof.md](phase-0b2r-compose-runtime-proof.md)

## 9. Status remains AMBER

Per the standing mandate, this section does not lift the status.
Remaining work: §13 (governance artifact cleanup), §14 (hook &
validation evidence), §15 (final AMBER closure), §16 (30-item closure
report).

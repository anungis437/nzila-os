# UE Hardening & Gate Convergence Wave — Phase 4 Report

**Phase:** 4 — Validator Path Repair (advisory validator doc-path drift)
**Date:** 2026-06-28
**Scope class:** Security / governance convergence — NOT product development
**Status:** COMPLETE → HARD STOP before Phase 5

---

## 1. Objective

Repair advisory-validator **path drift** so the four Union Eyes (UE) governance
validators read the **canonical** documentation corpus
(`docs/categories/products-and-market/union-eyes/…`) instead of the **stale
legacy tree** (`docs/union-eyes/…`).

**Primary invariant:** Validators must fail only on *real* missing evidence or
content defects — never because they look in the wrong doc tree.

**Explicitly out of scope (untouched):** gate taxonomy, CI wiring, advisory→
blocking promotion, live-readiness, `final:go` certification artifacts, runtime
separation, raw-DB guard classification, RLS code, pilot ownership, schema
design, product features. No doc trees moved. No evidence docs fabricated.

---

## 2. Validators repaired

| Validator | Legacy path read (before) | Canonical path read (after) |
|---|---|---|
| `validate:ue-infrastructure` | `docs/union-eyes/institutional-operating-infrastructure` | `docs/categories/products-and-market/union-eyes/institutional-operating-infrastructure` |
| `validate:runtime-authority` | `docs/union-eyes/runtime-authority-audit` | `docs/categories/products-and-market/union-eyes/runtime-authority-audit` |
| `validate:navigation-monetization` | `docs/union-eyes/navigation-monetization-matrix` | `docs/categories/products-and-market/union-eyes/navigation-monetization-matrix` |
| `validate:runtime-convergence` | `docs/union-eyes/{runtime-convergence,navigation-monetization-matrix,institutional-operating-infrastructure}` | canonical where it exists; legacy fallback for `runtime-convergence` (not yet migrated) |

### Mechanism

A single shared resolver was introduced rather than scattering literal paths:

- **`tooling/scripts/lib/ue-doc-paths.mjs`** (new)
  - `UE_CANONICAL_BASE` = `docs/categories/products-and-market/union-eyes`
  - `UE_LEGACY_BASE` = `docs/union-eyes`
  - `resolveUeAreaDir(repoRoot, area)` — **prefers canonical**, falls back to
    legacy only if canonical is absent, and defaults to the **canonical** path
    when neither exists (so genuine missing-evidence errors point operators at
    the correct location). It **fabricates nothing** — it only points
    validators at wherever the real docs actually live.
  - `ueAreaIsLegacy(repoRoot, area)` — true only while an area remains
    legacy-only (migration pending).

All four validators now import this resolver and use it for both their root
directories and their dynamic upstream-anchor joins. No validator hard-codes a
legacy `docs/union-eyes/<area>` path for a migrated area anymore.

The `validate:runtime-authority` "Missing file" error message now renders the
**resolved** (canonical) relative path instead of a hard-coded legacy string.

---

## 3. Path drift closed — evidence

Before repair, all four validators failed because the UE doc corpus was not
found at all (empty corpus → cascading "missing docs" and "missing tone signal"
errors). After repair, the "Missing required … docs" sections are **gone** for
all four validators, confirming the canonical corpus is now read.

### Re-run logs (post-repair)

```
═══ validate:ue-infrastructure ═══
UE institutional infrastructure validation FAILED.
- Upstream anchor docs required by UE infrastructure layer are missing:
  - docs/nzila-cognition-doctrine/institutional-operational-cognition-doctrine.md
  - docs/nzila-cognition-doctrine/procurement-governance-positioning-refactor.md
  - docs/nzila-maturity-elevation/master-maturity-index.md
  - docs/nzila-final-convergence/final-full-maturity-review.md
- Final UE review missing required validator references: validate:cognition,
  validate:labor-continuity, validate:maturity-elevation,
  validate:final-convergence, validate:ue-infrastructure.
(exit 1)

═══ validate:runtime-authority ═══
OK — 16 runtime authority audit documents validated.
(exit 0)

═══ validate:navigation-monetization ═══
Navigation/monetization matrix validation FAILED.
- Final navigation/monetization review missing required validator references:
  validate:cognition, validate:labor-continuity, validate:maturity-elevation,
  validate:final-convergence, validate:ue-infrastructure,
  validate:navigation-monetization.
(exit 1)

═══ validate:runtime-convergence ═══
Runtime-convergence validation passed.
Validated docs: 12
Validated upstream anchors: 7
Validated required scripts: 7
(exit 0)
```

---

## 4. Failure classification (honest)

Per the Phase 4 directive, remaining failures are classified as: *fixed path
drift*, *real missing evidence*, *real content/tone defect*, or *deprecated
validator behavior*.

| Validator | Result | Classification |
|---|---|---|
| `validate:runtime-authority` | ✅ GREEN | **Fixed path drift** — path drift was the *only* defect; fully repaired. |
| `validate:runtime-convergence` | ✅ GREEN | **Fixed path drift** — UE-area drift repaired; `runtime-convergence` area correctly resolves via legacy fallback (not yet migrated). All 7 anchors + 7 scripts validate. |
| `validate:ue-infrastructure` | ⚠️ FAIL (real) | UE-area path drift **fixed** (12 canonical docs now read). Remaining failures are NOT UE path drift: (a) **real missing evidence** — upstream `docs/nzila-cognition-doctrine`, `docs/nzila-maturity-elevation`, `docs/nzila-final-convergence` anchors no longer exist in the active tree (they were **archived** to `docs/categories/historical-archive/archive/iterations/nzila-*/`); (b) **real content defect** — the final UE review doc does not enumerate the required validator references. |
| `validate:navigation-monetization` | ⚠️ FAIL (real) | UE-area path drift **fixed** (canonical nav/monetization + infrastructure docs now read). Remaining failure is a **real content defect** — the final navigation/monetization review doc does not enumerate the required validator references. |

### Note on the archived upstream anchors (deliberate non-action)

The four `docs/nzila-*` upstream anchors required by `validate:ue-infrastructure`
were located only under `docs/categories/historical-archive/archive/iterations/`.
These are **superseded iteration snapshots**, not the active canonical corpus,
and they are **outside the four named UE areas** of Phase 4. Re-pointing the
validator at archived/superseded material would amount to **fabricating
governance proof**, which the Phase 4 directive explicitly forbids
("Acceptable: repair validators so they point to the real canonical docs. Not
acceptable: create missing certification docs just to make validators pass.").

These were therefore left as honest failing signal and deferred — see §7.

---

## 5. Tests / assertions proving canonical paths are used

New contract test: **`tooling/contract-tests/ue-validator-paths.test.ts`**
(invariant `INV-PATH-UE`, 5 tests, all passing):

1. Resolver constants point at the canonical nested base.
2. Every repaired validator imports the shared resolver and no longer hard-codes
   a legacy `docs/union-eyes/<area>` join for any named UE area.
3. Migrated UE areas resolve to the canonical tree on this repo.
4. Resolver **prefers canonical over legacy** when both exist (synthetic repo).
5. Resolver defaults to the canonical path when neither tree exists (clean
   error-message target).

```
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

The test asserts **path wiring only**, by design — it does not assert validator
pass/fail, because the remaining real failures are intentionally out of Phase 4
scope.

---

## 6. Deprecated validator behavior

None introduced or removed. No validator was promoted from advisory to blocking.
No gate registry, gate taxonomy, or CI workflow was modified. The legacy base
remains supported as a **temporary compatibility fallback** purely so the
not-yet-migrated `runtime-convergence` area continues to resolve; it can be
retired once that area migrates.

---

## 7. Deferred to Phase 5+

The following are **real, honest failing signal** surfaced (not masked) by the
path repair — explicitly deferred, NOT fabricated away in Phase 4:

1. **Upstream doctrine anchors archived** (`validate:ue-infrastructure`): decide
   intentionally whether to (a) re-instate the `nzila-cognition-doctrine`,
   `nzila-maturity-elevation`, `nzila-final-convergence` anchors into the active
   tree, (b) re-point the validator at a deliberately chosen canonical location,
   or (c) drop/relax the requirement. This is a governance/doctrine decision,
   not a path-typo fix.
2. **Final-review docs missing validator references** (`validate:ue-infrastructure`,
   `validate:navigation-monetization`): the final review documents must be
   updated to enumerate the required `validate:*` references. This is genuine
   content authorship and must be done by the doc owners — not fabricated to
   force a green.

---

## 8. Files changed (Phase 4)

| File | Change |
|---|---|
| `tooling/scripts/lib/ue-doc-paths.mjs` | **New** shared canonical/legacy path resolver. |
| `tooling/scripts/validate-ue-infrastructure.mjs` | Import resolver; root via `resolveUeAreaDir`. |
| `tooling/scripts/validate-runtime-authority-audit.mjs` | Import resolver; `auditDir` via resolver; error message renders resolved path. |
| `tooling/scripts/validate-navigation-monetization.mjs` | Import resolver; roots + dynamic upstream-anchor join via resolver. |
| `tooling/scripts/validate-runtime-convergence.mjs` | Import resolver; three roots + dynamic upstream-anchor join via resolver. |
| `tooling/contract-tests/ue-validator-paths.test.ts` | **New** `INV-PATH-UE` contract test (5 tests). |

No product code, gate registry, CI workflow, or documentation corpus was
changed. No evidence documents were created.

---

## 9. Outcome

Phase 4 is **successful by its own definition**: the stale-path validators no
longer fail for fake (wrong-doc-tree) reasons.

- 2 / 4 validators are now **fully green** (path drift was their only defect).
- 2 / 4 now fail for **real** reasons (archived upstream evidence + missing
  validator references in final-review docs), correctly surfaced and deferred.

**HARD STOP.** Phase 5 (gate taxonomy + CI authority) is **not** started.

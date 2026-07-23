# Phase 0B.1 — Clean Branch Provenance

**Clean branch:** `fix/union-eyes-phase0b-clean`  
**Basis commit:** `4d6f63511` — "Phase 0A.1: closure docs + phase ledger amendment (GREEN)"  
**Worktree path:** `../nzila-automation-phase0b-clean` (relative to
`C:/APPS/nzila-automation`).  
**Purpose:** Provide a reviewable, deployable Phase 0B change set that
contains only the Direct + Supporting content identified in
[phase-0b-commit-disposition.md](phase-0b-commit-disposition.md), reconciled
against the two-lineage architecture decision.

## Non-destructive stance

- The historical branch `fix/union-eyes-reality-remediation` is preserved
  intact (5 Phase 0B commits `4d6f63511..7a1c90ab3` remain on `origin`).
- No `git reset`, no `git rebase -i`, no force-push, no branch deletion.
- No commit hashes on the historical branch will change.

## Provenance of each file the clean branch will carry

Each clean-branch file is either:

1. **Extracted from a Phase 0B commit** on the historical branch via a
   narrow path checkout (`git show <sha>:<path>` → written to the same
   path in the clean worktree). Provenance recorded per-file below.
2. **Authored newly on the clean branch** to close a gap identified in
   Phase 0B.1 (production resolver integration; KPI DB migration; corrected
   evidence documents; new decision documents).

No content is copied blindly. Each extracted file is re-read and, where the
disposition doc flags a wording review, updated for consistency with the
final architecture decision.

## Extraction plan (from historical → clean)

| From commit | Path | Extraction command (run in clean worktree) | Post-extraction action |
| --- | --- | --- | --- |
| `511c9c1cb` | `packages/db/drizzle/0038_phase_0b_organization_and_kpi_integrity.sql` | `git show 511c9c1cb:packages/db/drizzle/0038_phase_0b_organization_and_kpi_integrity.sql > packages/db/drizzle/0038_phase_0b_organization_and_kpi_integrity.sql` | Verify outcome-class values, IF NOT EXISTS guards, no destructive DDL. |
| `511c9c1cb` | `reports/audits/cupe-national-phase-0/organization-model-decision.md` | Same pattern. | Update wording to align with final architecture decision (Steps 7–8). |
| `511c9c1cb` | `reports/audits/cupe-national-phase-0/organization-model-dependency-map.md` | Same pattern. | Keep as-is unless dependency map changes materially. |
| `c40a3e33a` | `apps/union-eyes/lib/organizations/platform-tenant.ts` | Same pattern. | Keep. |
| `c40a3e33a` | `apps/union-eyes/lib/__tests__/platform-tenant.test.ts` | Same pattern. | Keep. |
| `896a18e0c` | `packages/ue-cognition/src/schema.ts` | Same pattern. | Keep, but do **not** commit until companion DB migration is authored. |
| `7a1c90ab3` | `reports/audits/cupe-national-phase-0/logs/**` | Per-path extraction of the Phase 0B log subset only. | Keep; validation summary will reference them. |
| `7a1c90ab3` | `.gitignore` | Same pattern. | Diff review — accept only the allowlist lines added for Phase 0B logs. |

## Files newly authored on the clean branch

| Path | Purpose |
| --- | --- |
| `packages/db/drizzle/0039_<name>_kpi_id_text_promotion.sql` | Companion DB migration for the ue-cognition schema.ts uuid→text change (see `kpi-database-migration-proof.md`). |
| One or more Union Eyes API routes / data-access modules | Wire `getPlatformTenantId(...)` into a real baseline service so the resolver is not merely test-covered (see `organization-resolver-integration-proof.md`). |
| `reports/audits/cupe-national-phase-0/phase-0b-validation-summary.md` (corrected) | Reflects actual commit count (5), clean tree at closure, real dates, and explicit lefthook-bypass disclosure with equivalent-validation evidence. |
| `reports/audits/cupe-national-phase-0/cupe-national-phase-ledger.md` (amended) | Records Phase 0B.1 execution + closure status. |

## Forbidden operations on the clean branch

- No `git add -A` in any commit. Every commit stages files by explicit
  path enumeration.
- No test-infra sweep (`vitest.config.ts` mass-edit) travels on this branch.
  If a specific package's vitest timeout must change to make a Phase 0B
  test run, that single `vitest.config.ts` file is included in the same
  commit as the Phase 0B test that requires it, with a comment stating why.
- No `$env:LEFTHOOK = "0"`. All commits go through the pre-commit hook.
  When a hook fails, capture the exact failure, fix the defect, and retry.
  Do not bypass without direct equivalent validation and explicit evidence.

## Ordering constraint

The clean branch must not accept Phase 0B commits until the architecture
decision in `phase-0b-lineage-architecture-decision.md` is signed off by
Aubert. Migration 0038's Outcome C wording, and the resolver's contract,
both depend on that decision. Landing Phase 0B commits earlier risks
re-introducing the same disposition/reality gap that made Phase 0B.1
necessary.

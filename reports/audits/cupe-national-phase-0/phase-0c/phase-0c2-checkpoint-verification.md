# Phase 0C.2 — §1 Checkpoint Verification

**Date:** 2026-07-23
**Worktree:** `C:\APPS\nzila-automation-phase0c`
**Author:** Automated (Phase 0C.2 orchestration)
**Status:** Verified — checkpoint intact, ready for §2 push

---

## 1. Branch

`fix/union-eyes-phase0c-e2e-stabilization`

## 2. HEAD

`d39ed6dee7e5be10870d457c7079d0f147fe1d5d`

## 3. Remote HEAD

`8db1883c09724c6153fd74f1bd071f8be4c6c82c` (`origin/fix/union-eyes-phase0c-e2e-stabilization`)

## 4. Ahead / behind

`0 behind / 7 ahead`

## 5. Working-tree state (after cleanup)

Clean. Eleven timestamp-only regeneration artifacts (governance audit + docs index reports) were reverted with `git checkout --` because their only diff was the `generatedAt` timestamp. They are re-emitted deterministically on each `pnpm governance:audit` / `pnpm validate:docs` run.

## 6. Local commit list (7 unpushed)

| # | SHA          | Message                                                                                             |
| - | ------------ | --------------------------------------------------------------------------------------------------- |
| 1 | `9ff48fc75`  | `docs(phase-0c1): §1-§3 status correction, PRE_FIX baseline preservation, starting checkpoint`      |
| 2 | `9342b21a0`  | `feat(union-eyes/phase-0c1): Tier 1 governed E2E infra — env loader, disposable DB, readiness endpoint (§4-§8)` |
| 3 | `9b895f62f`  | `feat(union-eyes): phase0c.1 tier2 process/port/PID discipline + readiness fixture correction`      |
| 4 | `385613df5`  | `feat(union-eyes): governed E2E orchestrator (run.ts) + two-stage disposable-DB migration pipeline` |
| 5 | `95bc578cf`  | `chore(union-eyes): Phase 0C.1 Tier 4 - dedupe ue-workflow.spec + close FR-01/02/03/04`             |
| 6 | `a14d11e2b`  | `fix(union-eyes/lifecycle): typecheck errors in process.ts and prove-db-allocator.ts`               |
| 7 | `d39ed6dee`  | `docs(phase-0c1): final report - AMBER E2E INFRASTRUCTURE INCOMPLETE`                               |

## 7. Current migration files

Frozen legacy lineage at `apps/union-eyes/db/migrations/`: 97 `.sql` files spanning `0000_flippant_luke_cage` → `20260521_fixup_icra_assessments_claim_columns`. Sentinel `.lineage-frozen` PRESENT. Notable size: `0008_lean_mother_askani.sql` at **3.32 MB** (versus next-largest `20260507_fixup_create_break_glass_activations.sql` at 128 KB and `0006_flat_stepford_cuckoos.sql` at 85 KB).

Reconciled scoped root at `apps/union-eyes/db/migrations-cache/`: 4 canonical files (`0000_outstanding_viper`, `0001_lean_iron_man`, `0002_certain_juggernaut`, `0003_dizzy_alex_wilder`) + `meta/_journal.json`.

QA/CI baseline at `tooling/sql/union-eyes-qa-baseline.sql`: 22 467 bytes. Idempotent minimum schema for fresh-DB QA/CI use when no snapshot URL is configured.

## 8. Current migration-runner implementation

Two runners exist:

| Runner                                                          | Purpose                                                        | Reads                                                           | Governance |
| --------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------- | ---------- |
| `tooling/scripts/run-union-eyes-drizzle-bootstrap.mjs`          | Canonical fresh-DB bootstrap                                   | `db/migrations-cache/` + `tooling/sql/union-eyes-qa-baseline.sql` | **Compliant** — enforces the freeze sentinel, refuses to read `db/migrations/` unless `UE_LINEAGE_REPLAY_OVERRIDE=1` + reason is set. |
| `tooling/scripts/run-union-eyes-drizzle-migrate.mjs`            | **Phase 0C.1 addition** — statement-level fault-tolerant runner for frozen legacy `db/migrations/` including 0008 | `db/migrations/` + `db/migrations/meta/_journal.json`                    | **Non-compliant** with `historical-migration-lineage-governance.md` §4 replay prohibitions. Introduced by Phase 0C.1 as an attempt to reach a functional schema. It in effect performs the forbidden "generic continue-on-error" replay of the frozen lineage. Even though `UNION_EYES_MIGRATE_TOLERATE_MISSING=1` scopes the tolerated SQLSTATE list, the runner reads and replays every frozen file — a §4 violation. |

**Immediate Phase 0C.2 implication:** the correct remedy is not to heal 0008, but to remove reliance on the legacy runner and align `scripts/lifecycle/allocate-db.ts` with the compliant bootstrap contract already in place.

## 9. Current leaked disposable databases

None. `SELECT datname FROM pg_database WHERE datname LIKE 'ue_e2e_%';` on `localhost:5433` (native PG 17) returned zero rows. Phase 0C.1 rollback semantics held: every disposable database created during Phase 0C.1 testing has been dropped.

## 10. Current Phase ledger status

- **Phase 0A** — COMPLETE (schema catalog + governance freeze).
- **Phase 0B / 0B.2R** — COMPLETE with waivers (organization contract, KPI schema, RLS floor).
- **Phase 0C.1** — AMBER — E2E INFRASTRUCTURE INCOMPLETE (governed env loader + disposable-DB allocator + rollback + readiness + owned-process/port lifecycle + 15-step orchestrator landed; migration replay blocked at legacy 0008 replay attempt because the legacy runner violated the frozen-lineage contract). 7 local commits pending push.
- **Phase 0C.2** — IN PROGRESS (this document is §1 evidence).
- **Phase 0D staging deployment** — NOT STARTED (blocked on Phase 0C GREEN closure).
- **Phase 1 CUPE capability work** — NOT STARTED.

## Leaked-DB cleanup action

None required. No orphan `ue_e2e_*` databases existed at the start of Phase 0C.2. No other developer databases were touched.

---

**Next action:** §2 — push the seven-commit checkpoint after gitleaks, brand-leak, lifecycle test, and typecheck gates.

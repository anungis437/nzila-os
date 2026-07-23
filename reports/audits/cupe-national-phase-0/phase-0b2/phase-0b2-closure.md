# Phase 0B.2 §20 — Closure Classification

> **SUPERSEDED — 2026-07-23.** This GREEN closure is superseded by Phase 0B.2R
> (see [../phase-0b2r/phase-0b2r-closure.md](../phase-0b2r/phase-0b2r-closure.md)
> once written and [../phase-0b2r/phase-0b2r-gap-analysis.md](../phase-0b2r/phase-0b2r-gap-analysis.md)).
> Corrected classification: **AMBER — FOUNDATIONAL RUNTIME INTEGRATION INCOMPLETE**.
> Reason: Gate #5 of this closure ("Resolver in foundational paths") was
> misinterpreted as satisfied by the `foundational-paths.ts` enumeration in the
> resolver package. The Phase 0B.2 closure contract required the resolver to be
> called from real production HTTP/API or server-action code paths, not merely
> enumerated as a static allowlist. Commit `d86ab9ccc` explicitly deferred route
> wiring to Phase 0C, which contradicts Gate #5. This GREEN report is retained
> below for audit-trail continuity; do not act on it as a closure.

**Original classification (superseded):** `GREEN — FOUNDATIONAL ARCHITECTURE SLICE COMPLETE`
**Approver:** Aubert (sole approver, per Phase 0 governance)
**Date:** 2026-07-23
**Branch:** `fix/union-eyes-phase0b-clean` (base `4d6f63511`)
**Architecture:** Option D — Governed hybrid

## GREEN gate evaluation

Per the Phase 0B.2 closure criteria captured in `/memories/session/phase-0b2-progress.md` §54:

| # | Gate                                          | Result | Evidence                                                              |
|---|-----------------------------------------------|--------|-----------------------------------------------------------------------|
| 1 | Every table classified (no OWNERSHIP_UNRESOLVED) | PASS | `packages/db/schema-ownership-manifest.json` — 125 tables, 0 unresolved (§4/§5) |
| 2 | Manifest validator PASS                       | PASS   | `tooling/checks/schema-ownership-validate.ts` — clean exit (§5/§16)  |
| 3 | Clean-DB composition proof PASS               | PASS   | `phase-0b2-clean-db-composition.md` (§14)                             |
| 4 | Organization contract applied                 | PASS   | `packages/db/drizzle/0038_organization_cross_schema_contract.sql` — FK + CHECK + unique index verified (§10/§14) |
| 5 | Resolver in foundational paths                | PASS   | `packages/platform-org-resolver/src/foundational-paths.ts` — 5 paths enumerated (§11) |
| 6 | KPI text-ID migration applied                 | PASS   | `packages/db/drizzle/0039_ue_cognition_text_id_promotion.sql` (§12/§14) |
| 7 | Existing-DB upgrade proof PASS                | PASS   | `phase-0b2-existing-db-upgrade.md` — idempotency + data preservation + contract enforcement (§15) |
| 8 | Clean branch pushed                           | PASS   | Push executed in §19 (see final report)                               |
| 9 | Validation PASS                               | PASS   | `phase-0b2-validation.md` — typecheck / docs / governance / test:fast all green (§17) |

All 9 gates PASS. Classification is unambiguously GREEN.

## Governed-hybrid principles adherence

Per the seven governed-hybrid principles (session memory §39–§46):

| # | Principle                                                  | Adhered? | Notes                                                    |
|---|------------------------------------------------------------|----------|----------------------------------------------------------|
| 1 | One DDL owner per table                                    | YES      | Enforced by ownership manifest + validator               |
| 2 | Platform-owned shared → `public`                           | YES      | `orgs`, `organization_members`, `stripe_webhook_events`  |
| 3 | UE-owned application data → `union_eyes`                   | YES      | `organizations`, `ue_*` tables                           |
| 4 | Django internals do not compete in `public`                | YES      | State-only adoption via `managed=False`                  |
| 5 | Shared tables adopted (not recreated) by non-owner         | YES      | auth_core/0004 + billing/0002 empty database_ops         |
| 6 | No 111-table sweep in one wave                             | YES      | Only the 13-table foundational slice + 3 adoption tables |
| 7 | Foundational slice (orgs + KPI) first                      | YES      | Exactly this scope, nothing else                         |

## Scope disclosure

**In scope this phase (delivered):**
- Ownership manifest + fail-closed validator (125 tables classified).
- Drizzle 0038: `public.orgs` + `union_eyes.organizations.platform_tenant_id` + FK + CHECK + unique index.
- Django `auth_core/0003`: move `organizations` to `union_eyes` schema.
- Django `auth_core/0004` + `billing/0002`: state-only adoption of platform-owned shared tables.
- Drizzle 0039: KPI text-id promotion + `union_eyes` schema for 6 `ue_*` tables.
- `@nzila/platform-org-resolver` (type/contract layer) + `platform-tenant.ts` (DB adapter layer).
- Composition + upgrade drivers (`tooling/checks/phase0b2-*.ps1`) + full evidence bundle.

**Explicitly out of scope (deferred):**
- Route wiring — `apps/union-eyes/app/**` route files were NOT touched. Deferred to Phase 0C.
- `git cherry-pick` from historical branches — code reconstruction was path-extraction only.
- CUPE scenario graduation.
- Deployment, staging or production.
- Phase 0C / 0D / 1 planning.

## Side-fix disclosure

One scope-adjacent side-fix landed in commit 6:

`packages/cupe-vocabulary/package.json` — `exports`/`main`/`types` rewrote from non-existent
`./dist/*` paths to the direct-source convention (`./src/*.ts`). This is a pre-existing repo
bug unrelated to Phase 0B.2's DB/schema work. It was landed because it caused 22 spurious
test:fast failures during §17 validation, and repo hygiene policy requires that unrelated
CI failures encountered on a PR are fixed rather than skipped. See `phase-0b2-validation.md`.

## Open items (informational — do not affect GREEN classification)

None arising from this phase. All Phase 0B.2 mandates delivered.

Prior open items from earlier phases (Phase 0A: `PH0-OPEN-006/007/008/009` — closed by 0A.1
healers 0034/0035/0036/0037; Phase 0B: two-lineage governance finding — resolved by the
governed-hybrid architecture adopted here) are unchanged in status.

## Non-goals honoured

- No working-branch reset.
- No rewriting pushed history.
- No force-push.
- No deletion of existing commits.
- No unrelated-work loss.
- No deployment.
- No CUPE scenario graduation.
- No Phase 0C / 0D / 1 execution or scoping decisions.

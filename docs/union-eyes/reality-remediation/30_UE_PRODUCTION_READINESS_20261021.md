# UE production readiness — 2026-10-21 rebaseline

Mission `UE-PRODUCTION-READINESS-20261021`. Branch `ops/ue-production-readiness-20261021`, created from `origin/main` `596ef6b2ab6eb9745bd8c10e44ebc6cca4c0944d` (merge of #980). Branch policy: `ops/*` matches `scripts/release/validate-branch-tag-policy.ts`.

This file is the living matrix for that mission. Historical ledgers, including `29_UE_PHASE3A_RUNTIME_REALITY_DOSSIER.md`, stay historical. A source test is not a runtime pass. `UE_SAAS_OPERATIONAL_READINESS` stays `NO_GO — RUNTIME_PROOF_REQUIRED`. `UE_RUNTIME_RLS_TENANT_ISOLATION` stays `FAIL`. `UE_V2_CANONICAL_FRESH_BOOTSTRAP` stays `UNQUALIFIED`. `PRODUCTION_DEPLOYMENT_AUTHORIZED` stays `NO`. `CUSTOMER_DATA_EXECUTION_AUTHORIZED` stays `NO`.

## What this increment changed

Scoped migration `0019_deadline_reassignment_convergence` creates `deadline_reassignment_convergence` when absent and, when root `migrations/0049_union_eyes_deadline_convergence_tasks.sql` already created it, drops that migration's PUBLIC policy. The replacement is `ue_create_direct_org_rls_policy` (FORCE RLS, no empty-context fallback). `union_eyes_runtime` and `union_eyes_system` each receive `SELECT`, `INSERT`, `UPDATE`. The assign route inserts as the tenant role; the post-commit retry and the reminder cron update as the system role. A drifted column set is refused before policy or grant changes.

`0019` is source-tested on PGlite. It has not been applied to staging. `CHG-2026-0112` stays `PROPOSED`. No Azure resource was changed.

## Matrix

| GATE_ID | COMPONENT | REQUIRED_BEHAVIOR | CURRENT_EVIDENCE_SHA | ENVIRONMENT | STATUS | SEVERITY | OWNER | DEPENDENCIES | FIX | NEGATIVE_TEST | ACCEPTANCE_EVIDENCE |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UE-A-P0-IDENTIFIED | Phase A blocker inventory | Every production blocker has an executable fix or a named external owner | 596ef6b2ab6eb9745bd8c10e44ebc6cca4c0944d | source | PASS_SOURCE_ONLY | P0 | engineering | dossier 29 sections 12–22 | this matrix | a gate with no owner fails this row | this file |
| UE-B-CONVERGENCE-RLS | deadline_reassignment_convergence | Fail-closed direct-org RLS; 0049 PUBLIC fallback absent; runtime insert and system sweep grants | 596ef6b2 plus 0019 on this branch | PGlite | PASS_SOURCE_ONLY | P0 | engineering | 0010 helper, journal idx 19 | `0019_deadline_reassignment_convergence.sql` | empty context and cross-tenant read/write denied; drifted columns refused | `db/__tests__/deadline-reassignment-convergence-0019.pglite.test.ts` |
| UE-B-STAGING-RLS | deployed tenant isolation | Staging database matches the scoped journal, including 0015 and 0019, under FORCE RLS | dossier image sha256:48e6a029… / source eae195f2; not re-queried | staging | NOT_EXECUTED | P0 | release owner + change record | authorized identity, CHG window, restored clone | apply through the governed executor after preflight | merged SQL is not treated as a protected database | live `rls-verify --mode=preflight --require-deadline-engine-tables` |
| UE-B-BOOTSTRAP-V2 | canonical fresh bootstrap | V2 plan digests match current models and a fresh PG 15/16 bootstrap passes | 596ef6b2; file 29 section 22.3 still UNQUALIFIED | source plan | BLOCKED_DEPENDENCY | P0 | engineering | hash-locked CPython 3.11 wheelhouse; 0019 must be in the plan before a new qualification | do not regenerate the plan in this increment | stale plan digest is not a bootstrap pass | none on this branch |
| UE-C-REVISION-ISOLATION | Container Apps revisions | 0% traffic revisions cannot keep running workers against a migrated database | dossier 2026-10-19 multiple-revision mode; not re-inventoried | Azure staging | NOT_EXECUTED | P0 | release engineering | current `az containerapp` inventory without secret retrieval | deployment workflow still does not deactivate non-serving revisions | traffic weight 0 is not isolation | revision list, digests, and probe config bound to one SHA |
| UE-C-ROLLBACK | migration rollback | A traffic reversal is not described as undoing committed Django migrations | dossier 29 sections 14 and 18 | source | PASS_SOURCE_ONLY | P0 | release engineering | point-in-time restore under its own change record | unchanged; constraint restated | no fail-open restore script | `0015` header and CHG-2026-0112 text |
| UE-D-JOURNEYS | union workflows | Cases, assignment, deadlines, documents, audit on a continuous dataset | not executed | staging | NOT_EXECUTED | P0 | product + engineering | Gates B and C, synthetic identities | none in this increment | denial, retry, and duplicate paths included when executed | browser session log bound to the deployed digest |
| UE-D-IDENTITY | Entra, MFA, offboarding | Real staging identity denies cross-tenant access and revoked sessions | not executed | Entra + staging | BLOCKED_EXTERNAL_AUTHORITY | P0 | identity owner | tenant directory and test users | none | self-elevation by header, cookie, or parameter | IdP and session evidence |
| UE-E-WORKERS | reminder delivery | Successor reminder delivers once through a non-delivering sink | cron route calls `withSystemContext`; delivery not executed | source / staging | PASS_SOURCE_ONLY | P0 | engineering | Gate B grants; authorized sink | assign-route retry now uses `withSystemContext` | duplicate workers must not double-deliver | sink receipt, not a CI mock |
| UE-F-PRIVACY | retention and revocation | Document revocation, residency, and secret hygiene have an authorized disposition | Principal deferral in dossier 29 section 22.1 is not a clearance | source | BLOCKED_EXTERNAL_AUTHORITY | P0 | security owner | no secret retrieval in this mission | none | deferred rotation is not production clearance | owner-signed disposition |
| UE-G-CANDIDATE | release candidate | Source SHA, lockfile, image digests, migration hashes, and acceptance share one manifest | not built | CI + staging | BLOCKED_DEPENDENCY | P0 | release owner | Gates B–F | none | do not promote staging automatically | release manifest |
| UE-H-GO | production authorization | Explicit human GO | file 25 ruling | production | BLOCKED_EXTERNAL_AUTHORITY | P0 | release authority | every P0 above | none | this mission cannot grant GO | signed decision |
| UE-GOV-EXCEPTIONS | governance exceptions | No expired exception is silent, and no production-critical waiver is accepted by default | counted 2026-10-21 from `governance/exceptions/*.json` | source | NOT_EXECUTED | P1 | governance owners | per-entry justification review | none in this increment | expiry check only | 136 entries, 0 with `expiresOn` before 2026-10-21, 47 paths containing `union-eyes`. The historical "81" count is not the current file count. Justification validity is not decided here |

## Critical path

1. Land and review `0019` (this branch). Source isolation is necessary and not sufficient.
2. Re-inventory Azure revisions, digests, probes, and the database role. Do not reuse the 2026-10-19 revision list.
3. Qualify `0019` plus the existing scoped journal on an authorized restored clone. Refuse on drift.
4. Under an approved change record, isolate non-serving revisions, apply the journal with the governed executor, and run `rls-verify` with `--require-deadline-engine-tables`.
5. Run identity, workflow, worker-sink, and recovery acceptance against that candidate.
6. Production GO stays a separate human decision. Phase 3B recording stays closed while operational readiness is `NO_GO`.

## Classification

`NO_GO / RUNTIME_DEFECT` for the deployed service: the 2026-10-19 dossier's staging RLS and revision findings have not been re-measured, and `0019` is not on that database.

The convergence-table source defect is corrected on this branch and is `PASS_SOURCE_ONLY`.

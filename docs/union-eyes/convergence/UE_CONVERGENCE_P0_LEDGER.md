# UE-CONVERGENCE-P0-FINAL checkpoint

This ledger records what was verified on this branch. Unexecuted controls stay unexecuted.

## Checkpoint

| Field | Value |
| --- | --- |
| BASE_SHA | `12dd086ae906ced483942144ab6c27326fda2738` |
| CANDIDATE_SHA | The commit on `cursor/ue-convergence-p0-cfc5` that contains this checkpoint |
| WORKTREE | `/home/ubuntu/ue-convergence` |
| FILES_CHANGED | Membership UUID consumers, current strike-fund provenance statement, QA baseline column type, 0014 producer graph, branch-policy pattern, convergence ledgers |
| ROOT_CAUSE | The canonical membership column is a UUID foreign key, while frozen strike-fund SQL, the QA baseline, and several runtime joins still treated it as text or a slug. Migration 0014's preflight was a source census, and `cursor/*-cfc5` was outside branch policy |
| FIX_IMPLEMENTED | Current strike-fund provenance joins `organizations.id` and is tested separately from the frozen slug statement. Active reward, per-capita, seed-validation, and QA-baseline paths use the UUID column. `dues_assignments` is exported through the finance schema barrel. Branch policy accepts only `cursor/<kebab>-cfc5` |
| TESTS_EXECUTED | Projection tests, historical and current strike-fund PGlite tests, branch-policy validator, the 0014 producer graph, and PostgreSQL 16.15 execution of the current and frozen strike-fund statements |
| OBSERVED_RESULT | Historical text compatibility and current UUID compatibility are separate results. The producer graph reports Bootstrap V2 source declarations reachable, production drizzle bootstrap BLOCKED because 0014 runs before its producers, and runtime execution NOT_EXECUTED |
| DEPENDENT_EVIDENCE_INVALIDATED | Historical Bootstrap V2 G1–G7 digests are not evidence for this candidate. The frozen plan file was not regenerated. A passing historical strike-fund fixture is not current compatibility |
| REMAINING_DEFECTS | Production `db:bootstrap` still applies scoped 0014 before platform SQL and does not replay frozen lineage. Legacy clean-room and Bootstrap V2 clean-room require Docker, which is absent here. Financial endpoint guard is contained, not reconciled. Four-shard E2E is unexecuted |
| NEXT_EXECUTABLE_ACTION | Run `tooling/scripts/run-union-eyes-schema-lineage-cleanroom.mjs` on PostgreSQL 15 and `apps/union-eyes/scripts/bootstrap-v2/clean-room.ts` on PostgreSQL 16 in an environment with Docker and `UE_V2_WHEELHOUSE` |
| HUMAN_AUTHORIZATION_BOUNDARY | No merge, deploy, credential change, database provision, or governance-label change |

## Repository state checked before edits

| Item | Observation |
| --- | --- |
| `origin/main` | `12dd086ae906ced483942144ab6c27326fda2738` |
| Open pull requests | 17: #971, #970 at `5647851391f72468cf85d7ac5a6f6ac867ce4767`, and Dependabot #950–#964 |
| `e2e-credential-free` worktree | Absent on this machine and absent from `origin` heads. No UUID-preserving patch was found to retain |
| Preserved worktrees | `/workspace`, `/home/ubuntu/ue-data-portability`, `/home/ubuntu/ue-core-member`, `/home/ubuntu/ue-member-employment`, `/home/ubuntu/ue-post-v2` were not modified |
| Financial schemas | Not modified |

## Status

| Field | Status |
| --- | --- |
| SCHEMA_AUTHORITY | IN_PROGRESS. One projection defect corrected. Competing financial DDL was not adopted |
| DATABASE_TOPOLOGY | CONTAINED_NOT_RECONCILED. `FINANCIAL_ARCHITECTURE_DECISION=SAME_CANONICAL_DATABASE`. `FINANCIAL_RUNTIME_CONFIGURATION_COMPATIBILITY=INCOMPATIBLE`. `FINANCIAL_SERVICE_DEPLOYMENT_STATUS=UNDEPLOYED` |
| DJANGO_DRIZZLE_CONVERGENCE | IN_PROGRESS. Membership organization reference now follows the Django UUID contract |
| FRESH_BOOTSTRAP | NOT_EXECUTED |
| SUPPORTED_UPGRADE | NOT_EXECUTED |
| SCHEMA_DRIFT | NOT_EXECUTED |
| RLS_AND_AUTHORIZATION | NOT_EXECUTED |
| BUSINESS_COMPATIBILITY | NOT_EXECUTED |
| FOUR_SHARD_E2E | NOT_EXECUTED |
| CREDENTIAL_FREE_CI | NOT_EXECUTED. No credential-free worktree exists here |
| ADVERSARIAL_VERIFICATION | NOT_EXECUTED |
| SOURCE_INTEGRATION_READINESS | NOT_READY. This is one branch and does not merge #970 or Dependabot |
| REPOSITORY_RECONCILIATION | UNCHANGED. Seventeen open pull requests remain, including this draft |
| OPERATIONAL_READINESS | `UE_SAAS_OPERATIONAL_READINESS = NO_GO`, `UE_RUNTIME_RLS_TENANT_ISOLATION = FAIL`, `PRODUCTION_DEPLOYMENT_AUTHORIZED = NO`, `CUSTOMER_DATA_EXECUTION_AUTHORIZED = NO` |

## 0014 inventory

Machine-readable rows: `UE_0014_TARGET_INVENTORY.json`.

Denominator `DECLARED_OBJECTS` for the earlier census is the 100 preflight targets plus 14 parent names. That census is not lifecycle proof.

`tooling/scripts/union-eyes-0014-producer-graph.mjs` is the executable graph. On this source it reports every active target reachable by the next Bootstrap V2 compile, zero legacy-cleanroom targets without a declared producer before 0014, and all 100 active targets absent before 0014 on production `db:bootstrap`. The script exits 1 while that production order remains blocked. Neither clean-room was executed here. `dues_assignments` is the frozen-plan gap closed at the schema barrel; the frozen plan file was not regenerated.

## PostgreSQL execution

PostgreSQL 16.15 executed `0008_strike_fund_uuid_membership_provenance.sql` on database `ue_strike_uuid_proof`. The payment-date membership mapped to `11111111-1111-4111-8111-111111111111`. A second organization that became effective only after that date was not selected. Two organizations effective on the payment date aborted with the zero-or-ambiguous exception, and the disbursement row remained with a null `organization_id`. Frozen `20260909` against the UUID membership column failed with `operator does not exist: text = uuid`, and the disbursement row remained.

PostgreSQL 15 was not executed. Ubuntu 24.04's default archive has no `postgresql-15` package, and `run-union-eyes-schema-lineage-cleanroom.mjs` calls Docker. Docker is not installed here. Bootstrap V2 `clean-room.ts` also calls Docker and requires `UE_V2_WHEELHOUSE`, so that lifecycle is NOT_EXECUTED. Local PostgreSQL 16 does not substitute for either clean-room.

# UE-CONVERGENCE-P0-FINAL checkpoint

This ledger records what was verified on this branch. Unexecuted controls stay unexecuted.

## Checkpoint

| Field | Value |
| --- | --- |
| BASE_SHA | `12dd086ae906ced483942144ab6c27326fda2738` |
| CANDIDATE_SHA | The commit on `cursor/ue-convergence-p0-cfc5` that contains this checkpoint |
| WORKTREE | `/home/ubuntu/ue-convergence` |
| FILES_CHANGED | Production bootstrap stage order, platform strike-fund canonical create, payment-date fail-closed provenance, 0014 producer graph, three CI assertion updates, convergence ledgers |
| ROOT_CAUSE | The production runner applied every scoped migration, including 0014, before platform SQL. 0014 requires objects the platform lineage creates. Platform 0008 also read `payment_date` on a physical table that does not have that column |
| FIX_IMPLEMENTED | The runner and the producer graph share one stage list: scoped through 0013, platform SQL, a post-platform re-grant of the 0009 table privileges, then scoped 0014. Snapshot restore stamps foundation hashes only. 0008 fails closed when rows exist and `payment_date` is absent. An absent strike-fund table is created from the canonical Drizzle columns, not from frozen SQL |
| TESTS_EXECUTED | Affected Vitest files. Disposable PostgreSQL 16.15 databases `ue_conv_fresh` and `ue_conv_partial`: fresh run, repeat run, partial resume from scoped 0004, and an early `afterTag` refusal |
| OBSERVED_RESULT | `PRODUCTION_BOOTSTRAP_ORDER = FAIL`. The stage order ran and matched the graph, then 0014 fail-closed. 46 of 100 targets were physically present. 54 were absent. The 0014 hash was not inserted. Repeat execution skipped the 23 recorded hashes. `PG15_LEGACY_CLEAN_ROOM = UNEXECUTED`. `PG16_V2_CLEAN_ROOM = UNEXECUTED` |
| DEPENDENT_EVIDENCE_INVALIDATED | Historical Bootstrap V2 G1–G7 digests are not evidence for this candidate. The frozen plan file was not regenerated. The isolated strike-fund statement is not a clean-room result |
| REMAINING_DEFECTS | 54 migration-0014 targets and 10 parent tables are still absent after the legitimate runner. Their CREATE statements live in frozen `db/migrations/`, which the runner refuses to replay. Financial endpoint guard remains contained, not reconciled. Restricted RLS policies from 0014 were not installed |
| NEXT_EXECUTABLE_ACTION | Add forward platform CREATE statements for the 54 absent targets from current Drizzle declarations, then rerun the disposable PostgreSQL 16 bootstrap until 0014's own preflight passes. Run the V2 clean-room only where Docker, the pinned image digest, and `UE_V2_WHEELHOUSE` exist |
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
| FRESH_BOOTSTRAP | FAIL. Staged runner executed on disposable PostgreSQL 16.15. 0014 fail-closed with 54 targets absent |
| SUPPORTED_UPGRADE | PARTIAL. A second run skipped 23 recorded hashes and retried 0014. The closure hash stayed unstamped |
| SCHEMA_DRIFT | NOT_EXECUTED |
| RLS_AND_AUTHORIZATION | FAIL. Post-platform table grants were applied. 0014 policies were not, because the preflight aborted |
| BUSINESS_COMPATIBILITY | NOT_EXECUTED |
| FOUR_SHARD_E2E | FAIL on `4c87a6719`. All four shards stopped in platform 0008 with `column sfd.payment_date does not exist`. This candidate has not been re-run in CI |
| CREDENTIAL_FREE_CI | NOT_EXECUTED. No credential-free worktree exists here |
| ADVERSARIAL_VERIFICATION | NOT_EXECUTED |
| SOURCE_INTEGRATION_READINESS | NOT_READY. This is one branch and does not merge #970 or Dependabot |
| REPOSITORY_RECONCILIATION | UNCHANGED. Seventeen open pull requests remain, including this draft |
| OPERATIONAL_READINESS | `UE_SAAS_OPERATIONAL_READINESS = NO_GO`, `UE_RUNTIME_RLS_TENANT_ISOLATION = FAIL`, `PRODUCTION_DEPLOYMENT_AUTHORIZED = NO`, `CUSTOMER_DATA_EXECUTION_AUTHORIZED = NO` |

## 0014 inventory

Machine-readable rows: `UE_0014_TARGET_INVENTORY.json`.

Denominator `DECLARED_OBJECTS` for the earlier census is the 100 preflight targets plus 14 parent names. That census is not lifecycle proof.

`tooling/scripts/union-eyes-0014-producer-graph.mjs` imports the same stage list as the production runner. It reports Bootstrap V2 source declarations reachable, 57 active targets still without a platform or pre-0014 scoped CREATE, and exits 1. On `ue_conv_fresh`, 46 of the 100 targets were physically present before 0014 executed and 54 were absent. The three-target difference is physical presence from the QA baseline or another statement the graph does not treat as the producer. `dues_assignments` remains in the absent set. The frozen plan file was not regenerated.

## PostgreSQL execution

PostgreSQL 16.15 executed `0008_strike_fund_uuid_membership_provenance.sql` on database `ue_strike_uuid_proof`. The payment-date membership mapped to `11111111-1111-4111-8111-111111111111`. A second organization that became effective only after that date was not selected. Two organizations effective on the payment date aborted with the zero-or-ambiguous exception, and the disbursement row remained with a null `organization_id`. Frozen `20260909` against the UUID membership column failed with `operator does not exist: text = uuid`, and the disbursement row remained.

The same PostgreSQL 16.15 server then ran `run-union-eyes-drizzle-bootstrap.mjs` with `QA_TEST_ENV=true` against empty database `ue_conv_fresh`. Scoped 0000–0013 applied, platform 0001–0008 applied, the runtime role received table grants, and 0014 raised `RLS 0014 fail-closed: target table public.allocation_basis_snapshots does not exist`. A repeat run skipped every recorded hash and failed again at 0014. Database `ue_conv_partial` had only scoped 0000–0004. An `afterTag` apply refused because 0005 was unrecorded. The full runner then continued from 0005 and failed at the same 0014 preflight. `ON DELETE CASCADE` on `strike_fund_disbursements.organization_id` is the action already declared by `taxes.ts` and frozen `20260909`. `UE_V2_FINANCIAL_SCOPE_AUTHORITY` still marks the table NOT_PROVEN, so the action was not changed.

PostgreSQL 15 was not executed. Ubuntu 24.04's default archive has no `postgresql-15` package, and the legacy clean-room calls Docker. Docker is not installed here. Bootstrap V2 is the current lifecycle candidate and its clean-room also calls Docker and requires `UE_V2_WHEELHOUSE`, so that lifecycle is UNEXECUTED. The legacy script was left in place. Local PostgreSQL 16 does not substitute for either clean-room. `FINANCIAL_RUNTIME_CONFIGURATION_COMPATIBILITY` remains `INCOMPATIBLE`.

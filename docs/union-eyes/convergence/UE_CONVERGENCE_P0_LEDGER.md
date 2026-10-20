# UE-CONVERGENCE-P0-FINAL checkpoint

This ledger records what was verified on this branch. Unexecuted controls stay unexecuted.

## Checkpoint

| Field | Value |
| --- | --- |
| BASE_SHA | `12dd086ae906ced483942144ab6c27326fda2738` |
| CANDIDATE_SHA | Set at commit time on `cursor/ue-convergence-p0-cfc5` |
| WORKTREE | `/home/ubuntu/ue-convergence` |
| FILES_CHANGED | Canonical membership projection, legacy organization switch predicate, projection test, convergence ledgers |
| ROOT_CAUSE | `organization_members.organization_id` is a Django UUID foreign key in the accepted Bootstrap V2 plan, while the canonical Drizzle projection still typed it as text and one legacy route compared it to `organizations.slug` |
| FIX_IMPLEMENTED | Drizzle projection is `uuid` with a foreign key to `organizations.id`. The legacy switch route checks membership by that UUID only |
| TESTS_EXECUTED | `pnpm exec vitest run apps/union-eyes/db/__tests__/organization-members-insert-defaults.test.ts apps/union-eyes/db/__tests__/schema-organizations.test.ts` |
| OBSERVED_RESULT | 2 files, 11 tests passed. Fresh bootstrap remains unexecuted: this environment has no Docker daemon and no PostgreSQL server |
| DEPENDENT_EVIDENCE_INVALIDATED | Historical Bootstrap V2 G1–G7 digests are not evidence for this candidate. The frozen plan file was not regenerated and was not edited |
| REMAINING_DEFECTS | 0014 preflight targets have no Django model. 57 have no platform SQL producer. Financial endpoint contradiction is recorded and not changed. Legacy clean-room and four-shard E2E are unexecuted |
| NEXT_EXECUTABLE_ACTION | Run the legacy clean-room and Bootstrap V2 clean-room where PostgreSQL 16 is available, then disposition each 0014 target that the selected lifecycle does not create |
| HUMAN_AUTHORIZATION_BOUNDARY | No merge, deploy, credential change, database provision, or governance-label change |

## Repository state checked before edits

| Item | Observation |
| --- | --- |
| `origin/main` | `12dd086ae906ced483942144ab6c27326fda2738` |
| Open pull requests | #970 at `5647851391f72468cf85d7ac5a6f6ac867ce4767`, plus Dependabot #950–#964 |
| `e2e-credential-free` worktree | Absent on this machine and absent from `origin` heads. No UUID-preserving patch was found to retain |
| Preserved worktrees | `/workspace`, `/home/ubuntu/ue-data-portability`, `/home/ubuntu/ue-core-member`, `/home/ubuntu/ue-member-employment`, `/home/ubuntu/ue-post-v2` were not modified |
| Financial schemas | Not modified |

## Status

| Field | Status |
| --- | --- |
| SCHEMA_AUTHORITY | IN_PROGRESS. One projection defect corrected. Competing financial DDL was not adopted |
| DATABASE_TOPOLOGY | RECONCILED_WITHOUT_DATABASE_MUTATION. See the decision ledger |
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
| REPOSITORY_RECONCILIATION | UNCHANGED. Sixteen open pull requests remain |
| OPERATIONAL_READINESS | `UE_SAAS_OPERATIONAL_READINESS = NO_GO`, `UE_RUNTIME_RLS_TENANT_ISOLATION = FAIL`, `PRODUCTION_DEPLOYMENT_AUTHORIZED = NO`, `CUSTOMER_DATA_EXECUTION_AUTHORIZED = NO` |

## 0014 inventory

Machine-readable rows: `UE_0014_TARGET_INVENTORY.json`.

Denominator `DECLARED_OBJECTS` for this inventory is the 100 preflight targets plus 14 parent names in `0014_lineage_restoration_rls_closure.sql` at the base SHA. Zero targets are Django models. Forty-three are declared by platform SQL. Fifty-seven are not declared by Django or platform SQL. That is a source inventory, not a runtime pass.

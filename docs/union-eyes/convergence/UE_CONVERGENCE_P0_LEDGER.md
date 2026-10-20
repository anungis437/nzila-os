# UE-CONVERGENCE-P0-FINAL checkpoint

This ledger records what was verified on this branch. Unexecuted controls stay unexecuted.

## Checkpoint

| Field | Value |
| --- | --- |
| BASE_SHA | `12dd086ae906ced483942144ab6c27326fda2738` |
| CANDIDATE_SHA | The commit on `cursor/ue-convergence-p0-cfc5` that contains this checkpoint |
| WORKTREE | `/home/ubuntu/ue-convergence` |
| FILES_CHANGED | Fail-closed runtime grant lifecycle, platform `0009_canonical_lineage_relations`, 0014 producer graph, convergence contract test, ledgers |
| ROOT_CAUSE | Fresh bootstrap reached 0014 without the relations its preflight requires, and the runner committed the 0009 table DML grants before that security migration finished |
| FIX_IMPLEMENTED | Shared stage order is now foundation, runtime privilege quarantine, platform SQL, 0014 and 0015, then activation of the existing 0009 grant envelope. Platform 0009 creates the absent Drizzle relations and rejects an incompatible existing shape. `org_subscriptions`, `platform_invoices`, and `platform_payments` stay owned by the QA baseline |
| TESTS_EXECUTED | `convergence-p0-contracts.test.ts`. PostgreSQL 16.15 databases `ue_conv_closure`, `ue_conv_resume`, `ue_conv_fail`, `ue_ddl_probe`, and `ue_shape_probe` |
| OBSERVED_RESULT | Fresh bootstrap exit 0. 100 targets and 14 parents present. 0014 and 0015 hashes recorded. Deliberate 0014 abort left no runtime DML on relations without FORCE RLS and wrote no attestation. Repeat kept 26 distinct ledger hashes. `PG15_LEGACY_CLEAN_ROOM = UNEXECUTED`. `PG16_V2_CLEAN_ROOM = UNEXECUTED` |
| DEPENDENT_EVIDENCE_INVALIDATED | Historical Bootstrap V2 G1–G7 digests are not evidence for this candidate. The frozen plan file was not regenerated. Snapshot E2E on `31ab109a1` is not fresh-bootstrap evidence |
| REMAINING_DEFECTS | QA baseline shape for `org_subscriptions`, `platform_invoices`, and `platform_payments` differs from current Drizzle and was not rewritten. `cba_clauses` and `employers` exist and are not FORCE RLS. Successful activation restores 0009 DML on tables 0014 does not protect, including `strike_fund_disbursements`. Financial endpoint guard remains contained. Docker clean-rooms remain unexecuted |
| NEXT_EXECUTABLE_ACTION | Run the pinned PG16 Bootstrap V2 clean-room and the PG15 legacy qualification only on a runner that has Docker and `UE_V2_WHEELHOUSE`. Keep snapshot E2E distinct from this fresh installation |
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
| FRESH_BOOTSTRAP | PASS on disposable PostgreSQL 16.15 database `ue_conv_closure`. The runner exited 0. This is not a Bootstrap V2 clean-room |
| SUPPORTED_UPGRADE | PASS for repeat and partial resume. Repeat on `ue_conv_closure` skipped every recorded hash and left 26 distinct hashes. `ue_conv_resume` started after scoped 0004 and completed 0014 and 0015 |
| SCHEMA_DRIFT | FAIL-CLOSED for an incompatible existing table. `ue_shape_probe` kept `allocation_rules.id` as integer and created no other public table. QA baseline versus Drizzle shape drift on three billing relations was not repaired |
| RLS_AND_AUTHORIZATION | PASS for the 100 migration-0014 targets on `ue_conv_closure`: RLS enabled, FORCE RLS enabled, runtime and system policies present. `UE_RUNTIME_RLS_TENANT_ISOLATION` stays FAIL because relations outside that target list, including `strike_fund_disbursements`, `cba_clauses`, and `employers`, are not forced |
| BUSINESS_COMPATIBILITY | NOT_EXECUTED. Django is not installed in this environment. Application startup, seed, and worker suites were not run |
| FOUR_SHARD_E2E | PASS on GitHub run `39361641631` for snapshot-backed SHA `31ab109a1` (`UE E2E worker` 1/4 through 4/4). That run is not fresh-bootstrap evidence. This candidate has not been through CI |
| CREDENTIAL_FREE_CI | NOT_EXECUTED. No credential-free worktree exists here |
| ADVERSARIAL_VERIFICATION | NOT_EXECUTED |
| SOURCE_INTEGRATION_READINESS | NOT_READY. This is one branch and does not merge #970 or Dependabot |
| REPOSITORY_RECONCILIATION | UNCHANGED. Seventeen open pull requests remain, including this draft |
| OPERATIONAL_READINESS | `UE_SAAS_OPERATIONAL_READINESS = NO_GO`, `UE_RUNTIME_RLS_TENANT_ISOLATION = FAIL`, `PRODUCTION_DEPLOYMENT_AUTHORIZED = NO`, `CUSTOMER_DATA_EXECUTION_AUTHORIZED = NO` |

## 0014 inventory

Machine-readable rows: `UE_0014_TARGET_INVENTORY.json`.

Denominator `DECLARED_OBJECTS` for the earlier census is the 100 preflight targets plus 14 parent names. That census is not lifecycle proof.

The earlier census on `ue_conv_fresh` found 54 absent targets. Eight of the ten absent parents were also in that target set. The two parent-only names were `cba_clauses` and `employers`. Unique absent objects were 56. `dues_assignments` was in the absent set.

`0009_canonical_lineage_relations.sql` is the forward producer for those 54 targets plus the parent and foreign-key relations the current Drizzle declarations require: `deadline_reminder_executions`, `committees`, `cost_centers`, `fee_settlement_batches`, `employers`, `cba_clauses`, `bargaining_units`, `collective_agreements`, and `worksites`. Django models for those union-structure and bargaining names are stubs labeled "Migrated from drizzle". The SQL was emitted by `drizzle-kit` `generateMigration` from the current `pgTable` exports. `org_subscriptions`, `platform_invoices`, and `platform_payments` already exist from `tooling/sql/union-eyes-qa-baseline.sql` and are not created again. Their QA columns differ from the current Drizzle enums and nullability, so they were left unchanged.

`tooling/scripts/union-eyes-0014-producer-graph.mjs` now reports `productionDrizzleBootstrap0014 = DECLARED_COMPLETE` and `runtimeExecution = NOT_EXECUTED`. The source-graph exit is not PostgreSQL evidence. The frozen plan file was not regenerated.

## PostgreSQL execution

PostgreSQL 16.15 executed `0008_strike_fund_uuid_membership_provenance.sql` on database `ue_strike_uuid_proof`. The payment-date membership mapped to `11111111-1111-4111-8111-111111111111`. A second organization that became effective only after that date was not selected. Two organizations effective on the payment date aborted with the zero-or-ambiguous exception, and the disbursement row remained with a null `organization_id`. Frozen `20260909` against the UUID membership column failed with `operator does not exist: text = uuid`, and the disbursement row remained.

The same PostgreSQL 16.15 server then ran `run-union-eyes-drizzle-bootstrap.mjs` with `QA_TEST_ENV=true` against empty database `ue_conv_fresh`. Scoped 0000–0013 applied, platform 0001–0008 applied, the runtime role received table grants, and 0014 raised `RLS 0014 fail-closed: target table public.allocation_basis_snapshots does not exist`. A repeat run skipped every recorded hash and failed again at 0014. Database `ue_conv_partial` had only scoped 0000–0004. An `afterTag` apply refused because 0005 was unrecorded. The full runner then continued from 0005 and failed at the same 0014 preflight. `ON DELETE CASCADE` on `strike_fund_disbursements.organization_id` is the action already declared by `taxes.ts` and frozen `20260909`. `UE_V2_FINANCIAL_SCOPE_AUTHORITY` still marks the table NOT_PROVEN, so the action was not changed.

## Execution closure

PostgreSQL 16.15, database `ue_conv_closure`, `QA_TEST_ENV=true`, runner exit 0. The log is `/opt/cursor/artifacts/pg16-closure-fresh.log`. The runner reported `0014 physical preflight: all 100 targets and 14 parents exist`, applied `0014_lineage_restoration_rls_closure` and `0015_deadline_engine_rls_fail_closed_closure`, then activated grants. Catalog query: 100 targets present, 100 with `relrowsecurity` and `relforcerowsecurity`, 452 policies, 0 targets missing a `union_eyes_runtime` or `union_eyes_system` policy. Ledger rows: 26, all hashes distinct. 0014 hash `cd8a2814a0e101dd56b0a94449eda3dce6e99860b368690a5fad3b97791a64a5`. 0015 hash `cdd4840d7544f0ec7e81bf9bb269cf3dd82dc2d8bec7849d926430916463bced`. Platform 0009 hash `a63e237c6297e6371ab780525da2f80f6059a620c9ef35be88f5ab665dd58792`. One `drizzle.bootstrap_attestations` row on the first success.

`union_eyes_runtime` with no `app.current_org_id` read 0 `allocation_rules` rows and the insert was rejected with `new row violates row-level security policy`. With org `11111111-1111-4111-8111-111111111111` it saw only `Rule A`. A cross-tenant insert was rejected by the same policy. `union_eyes_system` saw both rows. `strike_fund_disbursements` has `payment_date timestamp NOT NULL`, `organization_id uuid NOT NULL`, and `ON DELETE CASCADE` to `organizations`. That cascade is still the action in `taxes.ts` and is still `NOT_PROVEN` in the financial-scope authority. It was not changed.

Repeat on the same database skipped every scoped and platform hash, left 26 distinct hashes and both disbursement-unrelated allocation rows, and wrote a second attestation. It did not quarantine, because both closure hashes were already recorded. `/opt/cursor/artifacts/pg16-closure-repeat.log`.

`ue_conv_resume` had extensions and scoped 0000–0004 only. The full runner skipped those five hashes, applied 0005 onward and platform 0009, and completed 0014, 0015, activation, and one attestation. `/opt/cursor/artifacts/pg16-closure-partial.log`.

`ue_conv_fail` installed an event trigger that raises on `CREATE POLICY` for `allocation_rules`. The runner applied foundation, quarantine, and platform SQL, passed the 0014 preflight, then aborted with `deliberate 0014 failure injection`. Exit 1. 0014 and 0015 hashes are absent. `drizzle.bootstrap_attestations` does not exist. Runtime `SELECT` and `INSERT` privileges on relations without FORCE RLS: 0. `SET ROLE union_eyes_runtime` against `allocation_rules` returned `permission denied for table allocation_rules`. `union_eyes_system` received the same denial on `billing_subscriptions`. Seventeen FORCE RLS relations from the earlier closures kept runtime `SELECT`. `/opt/cursor/artifacts/pg16-closure-failure.log`.

`ue_shape_probe` started with `allocation_rules(id integer)`. Platform 0009 raised `incompatible existing relation public.allocation_rules: expected 8 matching columns, found 0` and left that single public table unchanged.

PostgreSQL 15 was not executed. Docker is not installed. The Bootstrap V2 clean-room and the legacy PG15 clean-room stay UNEXECUTED. Local PostgreSQL 16 does not substitute for either. `FINANCIAL_RUNTIME_CONFIGURATION_COMPATIBILITY` remains `INCOMPATIBLE`. GitHub run `39361641631` on `31ab109a1` has four successful `UE E2E worker` shards. That is snapshot E2E, not this fresh database.

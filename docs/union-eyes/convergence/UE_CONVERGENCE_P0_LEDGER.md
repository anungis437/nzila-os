# UE-CONVERGENCE-P0-FINAL checkpoint

This ledger records what was verified on this branch. Unexecuted controls stay unexecuted.

## Checkpoint

| Field | Value |
| --- | --- |
| BASE_SHA | `12dd086ae906ced483942144ab6c27326fda2738` |
| CANDIDATE_SHA | The commit on `cursor/ue-convergence-p0-cfc5` that contains this checkpoint. Preserved prior candidate `e08977e6255f23f4aba0f2777b998bd3612792e9` |
| WORKTREE | `/home/ubuntu/ue-convergence` |
| FILES_CHANGED | Exact catalog activation, same-transaction 0009 revoke, scoped `0016_catalog_rls_authority_closure`, platform `0010_billing_relation_shape_authority`, `platform_services` authority entry, QA billing CREATE, packaged catalog admission, platform `0008_dapl_enum_label_evolution`, ledgers |
| ROOT_CAUSE | Successful activation granted `SELECT, INSERT, UPDATE, DELETE` on every public table after migration 0014, and migration 0009 could commit that envelope before quarantine. Later, the health route imported repository CLI code and `pg`, and historical DAPL enums did not match platform `0009` |
| FIX_IMPLEMENTED | 0009 grants and their revoke commit together. Activation grants only the reviewed storage-authority manifest, after the live catalog matches it. Scoped 0016 forces RLS on the remaining direct-org and ICRA system tables. Platform 0010 aligns an empty billing shape and refuses a populated incompatible shape. Application admission reads through `@nzila/db` and a digest-bound contract. Platform `0008_dapl_enum_label_evolution` adds the six missing DAPL labels before `0009` |
| TESTS_EXECUTED | Contract tests. PostgreSQL 16.15 databases `ue_conv_authority`, `ue_conv_partial2`, `ue_conv_window`, `ue_conv_interrupt`, `ue_conv_adv`, `ue_grant_window`, `ue_shape_empty`, `ue_shape_populated`, `ue_shape_compatible`. Prior `e08977e62` databases remain historical |
| OBSERVED_RESULT | Fresh and repeat activation exit 0 with 147/147 public tables classified and privilege-matched. `applicationReady` is false. Interrupted 0009 left no runtime grant and no attestation. `PG15_LEGACY_CLEAN_ROOM = UNEXECUTED`. `PG16_V2_CLEAN_ROOM = UNEXECUTED` |
| DEPENDENT_EVIDENCE_INVALIDATED | `e08977e62` on `ue_conv_closure` proved producers and the 100-target closure, not whole-catalog least privilege. Snapshot E2E on `31ab109a1` is not this candidate. Historical G1–G7 are not this candidate |
| REMAINING_DEFECTS | Strike-fund retention is still NOT_PROVEN. Docker clean-rooms, Django, workers, and both four-shard E2E modes are unexecuted on this candidate. GitHub E2E on `5762b45bb` and the build on `2d32f3549` are not this candidate |
| NEXT_EXECUTABLE_ACTION | Push this candidate and read the GitHub result for the production build, CUPE pilot contracts, and the four snapshot E2E workers. Fresh-bootstrap E2E, Django, workers, Bootstrap V2, and PG15 remain separate |
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
| SCHEMA_DRIFT | FAIL-CLOSED for a populated incompatible billing row. Empty legacy billing tables convert. Fresh QA CREATE uses the Drizzle enums and non-null `billing_account_id`. `ue_shape_probe` at `e08977e62` remains the integer `allocation_rules` proof |
| RLS_AND_AUTHORIZATION | PASS for effective public grants against the 806-entry manifest on `ue_conv_authority`: 147/147 tables classified, 0 privilege mismatches, FORCE RLS on the 15 relations that previously lacked it. `UE_RUNTIME_RLS_TENANT_ISOLATION` stays FAIL as the programme flag |
| BUSINESS_COMPATIBILITY | NOT_EXECUTED. Django is not installed. Application startup, seed, and worker suites were not run. Runtime SQL for the settings `platform_services` read and an own-org `allocation_rules` insert succeeded |
| FOUR_SHARD_E2E | PASS only for snapshot-backed SHA `31ab109a1` on GitHub run `39361641631`. Not evidence for this fresh privilege model |
| CREDENTIAL_FREE_CI | NOT_EXECUTED. No credential-free worktree exists here |
| ADVERSARIAL_VERIFICATION | EXECUTED on `ue_conv_adv`, `ue_grant_window`, and `ue_conv_interrupt`. See the catalog section |
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

## Full-catalog authority

Preserved checkpoint `e08977e6255f23f4aba0f2777b998bd3612792e9` on `ue_conv_closure`: fresh PostgreSQL 16.15 bootstrap, 100/100 `0014` targets, 14/14 parents, `0014` hash `cd8a2814a0e101dd56b0a94449eda3dce6e99860b368690a5fad3b97791a64a5`, `0015` hash `cdd4840d7544f0ec7e81bf9bb269cf3dd82dc2d8bec7849d926430916463bced`, repeat, partial resume, UUID strike-fund provenance, ambiguous attribution fail-closed, deliberate `0014` failure, and source/journal order. Those hashes are unchanged. That activation still used the broad public DML envelope. It is not whole-catalog least privilege.

Current PostgreSQL 16.15, `QA_TEST_ENV=true`, database `ue_conv_authority`. The runner applies scoped `0016_catalog_rls_authority_closure` and platform `0010_billing_relation_shape_authority`, then exact manifest grants. Attestation fields: `schemaMigrationComplete=true`, `securityPolicyVerified=true`, `runtimePrivilegesVerified=true`, `applicationReady=false`. Public tables: 147. Manifest entries: 806. Classified public tables: 147. Runtime and system privilege mismatches: 0. Whole catalog relations in `public`, `user_management`, `audit_security`, and `drizzle`: 163, including 2 sequences. `employers` has FORCE RLS. Runtime `strike_fund_disbursements` is SELECT without INSERT. Runtime `icra_organizations` is denied. System can insert an ICRA row. `platform_services` runtime SELECT is granted and INSERT is denied.

Repeat on `ue_conv_authority` skipped recorded hashes, did not skip catalog verification, and exited 0. `ue_conv_partial2` started after scoped `0004_hesitant_chameleon` and completed with 28 distinct ledger hashes and `applicationReady=false`.

Same-transaction proof on `ue_grant_window`: a second session received `permission denied for table secret` while the first transaction held an uncommitted GRANT, and again after that transaction committed the REVOKE. Live probes on `ue_conv_window` during bootstrap: 16 probes, 0 leaks, 14 `permission denied`, 2 post-activation reads hidden by RLS. `ue_conv_interrupt` was killed during migration `0009`. Ledger rows: 12. No attestation. Runtime SELECT and INSERT on `organizations`, and system SELECT, were denied.

Billing shape: empty legacy tables on `ue_shape_empty` converted to `subscription_status` and `billing_account_id` NOT NULL. `ue_shape_populated` kept 1 varchar row with a null account and raised `incompatible existing relation public.org_subscriptions`. `ue_shape_compatible` kept its row and added the foreign key.

Strike fund: deleting the organization inside a rolled-back transaction removed the synthetic disbursement (`strike_after_org_delete` count 0). `UE_V2_FINANCIAL_SCOPE_AUTHORITY` still says NOT_PROVEN. The `ON DELETE CASCADE` declaration was not changed.

Adversarial database `ue_conv_adv`: an unclassified table failed activation and had no runtime SELECT. A deleted `allocation_rules` policy failed activation while the closure hashes remained. Membership in `ue_excess` failed activation and left the inherited SELECT in place. A serving PUBLIC grant failed activation and left runtime SELECT true; the following QA enforcement removed it. A runtime SELECT grant on `icra_organizations` failed the serving check and was removed by QA enforcement. `employers` without FORCE RLS failed activation. A `SECURITY DEFINER` function failed activation. Renaming `union_eyes_runtime` failed activation with roles absent. A view `ue_leak` selected `Rule A` as `union_eyes_runtime` while the serving activation exited 1. The view was then dropped.

Django is not installed. Docker is not installed. No worker suite or four-shard E2E was run on this database.

## Runtime admission

PostgreSQL 16.15 database `ue_conv_authority`. Read-only `tooling/scripts/union-eyes-catalog-admission.mjs` exits 0 on the exact-grant catalog and prints `applicationReady=false`. A disposable drift added role `ue_excess`, `GRANT SELECT ON platform_services TO PUBLIC`, view `ue_admission_bypass`, security-definer `ue_admission_definer`, and dropped `ue_org_isolation_select` on `strike_fund_disbursements`. `union_eyes_runtime` could still `SELECT` `platform_services` while admission exited 1. The diagnostic named `environment=disposable-pg16`, source `apps/union-eyes/db/rls-storage-authority`, the inherited role, `PUBLIC holds SELECT on public.platform_services`, the view, the function, and the missing disbursement policy.

`apps/union-eyes/scripts/probe-health-admission.ts` imported `GET` from `app/api/health/route.ts`. During the drift the response was HTTP 503, `ok=false`, `checks.catalogAuthority.status=fail`, and `privileges_unchanged=true`. `--enforce` without `UE_PRIVILEGE_ENFORCEMENT=1` threw `Remediation refused` and changed nothing. With the flag, remediation revoked the membership and the unsafe execute grant, replayed scoped `0016` statement by statement, re-applied the manifest, and the following read-only admission exited 0. The view object remained. The same health import then returned HTTP 200 with `catalogAuthority.status=ok` and `applicationReady=false`. Log: `/opt/cursor/artifacts/runtime-admission.log`.

`union_eyes_runtime` read three synthetic `platform_services` rows as `down`, `unknown`, and `degraded`. None were counted healthy. A role without `SELECT` received `permission denied for table platform_services`. A filter for absent names returned 0. The operations page query is `service_name, status, updated_at` and does not reference `uptime_pct`, `platform_incidents`, `platform_login_events`, `platform_sla_metrics`, `platform_releases`, or `platform_capacity`.

Platform `0011_strike_fund_deletion_guard` is idempotent. On `ue_conv_authority`, deleting organization `cf453349-5b89-4bac-a976-3d93a54abd9c` while a disbursement existed raised `organization delete refused`. `status` updated to `inactive` and the disbursement count stayed 1. After that disbursement was deleted, the organization delete succeeded. The foreign key is still `ON DELETE CASCADE`. A repeat bootstrap applied `0011_strike_fund_deletion_guard`, skipped every earlier hash, and exited 0. `/opt/cursor/artifacts/pg16-authority-repeat-0011.log`.

Restricted SQL on the restored catalog: `union_eyes_runtime` `SELECT` on `user_management.users` returned 0 rows. `SELECT` on `audit_security.audit_logs` and `user_management.auth_audit_log` returned `permission denied`. `SELECT` on `drizzle.__drizzle_migrations` returned `permission denied for schema drizzle`.

`pnpm exec vitest run` for the 0013 journal test, the 0015 journal test, and `tests/api/operational-endpoints.spec.ts`: 3 files, 74 tests, exit 0. `/opt/cursor/artifacts/vitest-admission.log`.

GitHub on `5762b45bbf855077ee3b4b559c3f841233352862`, run `39367866277` job `118448721355`: 2 unit files failed because the journal tail was still asserted as idx 15. Those assertions now register idx 15 as `0015` and the 0013 maximum as 16. Run `39367866284` worker `118448721695`: snapshot bootstrap failed at platform `0009_canonical_lineage_relations` with `incompatible existing type public.platform_cost_type`. That SHA's E2E is not a pass. `PG15_LEGACY_CLEAN_ROOM` and `PG16_BOOTSTRAP_V2` remain UNEXECUTED. Docker is not installed. `import django` fails. No Celery worker was started.

`UE_SAAS_OPERATIONAL_READINESS = NO_GO`. `UE_RUNTIME_RLS_TENANT_ISOLATION = FAIL`. `PRODUCTION_DEPLOYMENT_AUTHORIZED = NO`. `CUSTOMER_DATA_EXECUTION_AUTHORIZED = NO`.

## Build boundary and historical enums

The thirteen enums in frozen `20260325_dapl_platform_ledger.sql` were compared with `migrations-audit/finance-enums.sql`, `migrations/finance-platform-billing-tables.sql`, and the ordered arrays in platform `0009`. Audit enums match the frozen DAPL definitions. The billing file and `0009` already carry the canonical labels. Only three types differ, and each historical label list is a subsequence of the canonical list:

| Enum | Labels absent from the frozen definition |
| --- | --- |
| `platform_cost_type` | `transaction_fee`, `settlement` |
| `ledger_event_type` | `fee_captured`, `settlement_closed` |
| `ledger_source_type` | `transaction_fee`, `settlement_batch` |

Platform `0008_dapl_enum_label_evolution` is journal idx 9, before `0009`. It does not edit frozen SQL or the `0009` hash. On PostgreSQL 16.15, `node tooling/scripts/prove-dapl-enum-evolution.mjs` exited 0. Fresh database `ue_dapl_enum_fresh` had no labels before the upgrade and the three `0009` enum checks then created the canonical lists. Historical database `ue_dapl_enum_historical` kept `adjustment`, `reversal`, and `system` on the inserted row, amount `12.50`, through rollback and after the upgrade. An extra `rogue_fee` label and a swapped `manual`/`system` order each raised `incompatible existing type` and left the labels unchanged. The platform runner recorded one hash on `ue_dapl_enum_ledger` and applied nothing on the second run. Evidence: `/opt/cursor/artifacts/dapl-enum-evidence.json`.

On the already canonical database `ue_conv_authority`, the same runner applied `0008_dapl_enum_label_evolution` once, left all three label lists unchanged, and a second run applied 0 migrations. Read-only catalog admission then exited 0 with `violationCount=0`.

`pnpm --filter @nzila/union-eyes... build` exited 0. Next.js 16.3.8 Turbopack compiled successfully. Log: `/opt/cursor/artifacts/next-production-build.log`. The standalone trace contains `apps/union-eyes/lib/operations/catalog-authority-contract.json` and does not contain `tooling/scripts/lib/union-eyes-catalog-authority.mjs`.

That standalone tree was copied to `/tmp/ue-packaged` and started with `node server.js` from `/tmp/ue-packaged/apps/union-eyes`. `GET /api/health` returned HTTP 200, `catalogAuthority.status=ok`, note `applicationReady=false`. `GRANT SELECT ON public.platform_services TO PUBLIC` then made the same process return HTTP 503 with public error `catalog authority admission failed`. The response catalog object did not contain privilege or object detail. The server log named `PUBLIC holds`. `UE_PRIVILEGE_ENFORCEMENT=1 node tooling/scripts/union-eyes-catalog-admission.mjs --enforce` restored admission, and the packaged process returned HTTP 200 again. `node tooling/scripts/prove-union-eyes-runtime-admission.mjs` also exited 0 on this code. `/opt/cursor/artifacts/runtime-admission.log`.

`pnpm exec vitest run --project contract-tests tooling/contract-tests/db-boundary.test.ts` passed 16 tests. `assertCatalogContractCurrent` matched digest `1625a0a942a1b8dd8737ba933852353791203483f52ddaa57c3a9b461a76b057` and 806 entries. The union-eyes contract file and convergence contract file passed 10 tests.

GitHub on `818ac810f`: E2E run `39372923246` restored the canonical snapshot and all four Union Eyes workers failed in platform `0009` with `incompatible existing type public.fee_adjustment_type`. Frozen `0086_monetization_phase2.sql` omits `partial_reversal`. A repo-wide comparison against `0009` found no other historical enum whose labels are not a subsequence of the canonical list. Platform `0008_fee_adjustment_enum_label_evolution` adds that label before `0009`. The DAPL file and its hash are unchanged. `prove-dapl-enum-evolution.mjs` exited 0 with `fee_adjustment_type` included: historical `waiver` stayed `waiver`, and the canonical order is `reversal`, `partial_reversal`, `waiver`, `correction`, `dispute_credit`.

CUPE Pilot Contract Tests on that SHA failed `NO_CONSOLE_001` at the two health-route `console.error` calls. Main CI run `39372923221` failed the same contract and the governance jobs that depend on it. Active Build, workspace typecheck, and CUPE unit tests on that SHA succeeded. Those calls now go through `createLogger('union-eyes.health')` from `@nzila/os-core/telemetry`. `tooling/contract-tests/no-console.test.ts` passed 2 tests. The public health error string is unchanged. A rebuilt standalone server returned HTTP 200, then HTTP 503 after a PUBLIC grant, with the diagnostic in the structured logger and not in the public catalog object, then HTTP 200 after remediation.

`QA_TEST_ENV=true` bootstrap of empty PostgreSQL 16.15 database `ue_conv_head_fresh` exited 0. It applied both enum evolutions before `0009`, passed the 0014 preflight, activated exact grants, and recorded `violationCount=0` with 147 public tables. Log: `/opt/cursor/artifacts/pg16-head-fresh-bootstrap.log`.

GitHub on `cfd72957a`: CI run `39374251507` succeeded and CUPE run `39374251562` succeeded. `NO_CONSOLE_001` is closed on that SHA. E2E run `39374251556` restored the canonical snapshot and all four Union Eyes workers failed in platform `0009` with `incompatible existing relation public.employers: expected 33 matching columns, found 1`. The fee-label migration had already applied. Control-plane, console, and web shards succeeded. The creation lineage for `employers`, `worksites`, `bargaining_units`, `committees`, `collective_agreements`, `cba_clauses`, and `cost_centers` is the Django initial stub: `id`, `created_at`, `updated_at`, and nullable `organization_id`. `collective_agreements` also has nullable `cba_number varchar(255)`.

Platform `0008_django_stub_relation_evolution` runs after the fee-label migration and before `0009`. It does not edit `0009` or the enum files. A missing relation stays missing. An already canonical relation is unchanged except for a missing foreign key. A recognized relation is any subset of the canonical column names, which covers the four-column Django stub and a stub that already has a canonical column such as `cba_id`. An empty subset gains the missing canonical columns. A populated subset is tightened only when every existing value already satisfies the canonical nullability and length. A missing canonical `NOT NULL` column, an unrecognized column, or a differing enum label list raises `Rows were not rewritten` and leaves the table unchanged. `node tooling/scripts/prove-django-stub-relation-evolution.mjs` exited 0. Evidence: `/opt/cursor/artifacts/django-stub-relation-evidence.json`. The empty stubs then passed the `0009` column and foreign-key statements. One populated employer row, the eight-column `org_id` shape, and an `employer_type` enum containing only `private` each failed closed.

`QA_TEST_ENV=true` bootstrap of empty PostgreSQL 16.15 database `ue_conv_stub_fresh` exited 0. It applied `0008_django_stub_relation_evolution` immediately before `0009`, passed the 0014 preflight, and completed exact grants. `employers` has 33 columns. Public tables: 147. `platform_cost_type` includes `transaction_fee` and `settlement`. `fee_adjustment_type` is `reversal`, `partial_reversal`, `waiver`, `correction`, `dispute_credit`. Read-only admission exited 0 with `violationCount=0` and `applicationReady=false`. Log: `/opt/cursor/artifacts/pg16-stub-fresh-bootstrap.log`.

GitHub on `a2ebb60f8`, E2E run `39376703294`, restored the snapshot and all four Union Eyes workers failed in `0008_django_stub_relation_evolution` with `unrecognized historical columns ({cba_id,created_at,id,organization_id,updated_at})` on `public.cba_clauses`. That column set is a subset of the canonical columns, so the exact four-column signature was too narrow. The migration now accepts a subset. If a snapshot row cannot satisfy a canonical `NOT NULL` column, the migration still refuses that row instead of inventing `name` or `employer_type`. Django models for these seven names remain the stub fields, so Django `objects.create()` against a widened table is not claimed. Fresh four-shard E2E, workers, Bootstrap V2, and PG15 remain separate from this local proof. The GitHub E2E workflow is the snapshot path. There is no second workflow for a fresh-database four-shard run. Django execution in this repository is attached to deployment workflows that require cloud credentials, which are not added to pull-request jobs.

`UE_SAAS_OPERATIONAL_READINESS = NO_GO`. `UE_RUNTIME_RLS_TENANT_ISOLATION = FAIL`. `PRODUCTION_DEPLOYMENT_AUTHORIZED = NO`. `CUSTOMER_DATA_EXECUTION_AUTHORIZED = NO`.

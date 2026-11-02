# Convergence tranche 10a: NOT NULL and defaults agree across the declarations, the models and the database

Date: 2026-11-02. Branch `agents/ue-cursor-final-closure`. Base commit `39403a3b1`; source commit: see the ledger entry `UE-NOT-NULL-DEFAULTS-CONVERGENCE-20261102` (this tranche is one source commit with 10b and 10c).
Platform migrations `0072_declared_not_null_2`, `0073_declared_defaults`, `0074_model_defaults_physical`.
Credit: none (cross-cutting source evidence, `defectCredit` 0, `closureCredit` 0). Nothing is closed. `READY_FOR_STAGING` stays `NO`.
This tranche acts on the directions "always fix whats missing", "address all the missing tables, columns etc" and "if you identify flaws or missing aspects, fix them too": tranche 8 left the strictness of the
database (which columns refuse NULL, which carry a default) different in the Drizzle declarations, the Django models and the physical schema, so the same row could be accepted by one writer and refused by another.

## What was wrong

Measured on the converged database before the change:

- 136 columns that a Drizzle declaration says are NOT NULL were nullable in the database (`NOT_NULL_ABSENT`), so a declared-required column could store NULL through any other writer.
- 35 defaults that a declaration gives (`DEFAULT_ABSENT`, `NO_DB_DEFAULT`) were not physical. Among them the `id` of `claims`, `grievances` and `organizations`, and `mission_audits.impacts_consecutive_compliance`: the column is
  NOT NULL, the application's route inserts without it, and the column had no default, so **the TS `mission-audits` route could never insert a row**.
- 35 defaults that only a Django model gave, on 13 relations no declaration names, so a row written by anything but Django failed (NOT NULL) or stored something else.
- 68 Django defaults that the platform does not declare, so the same row differed by writer; 128 Django fields were `null=True` or defaulted over a column the platform makes NOT NULL.
- A second route that could not insert, found by measuring the production raw `INSERT` statements against the converged catalog: `POST /api/governance/reserved-matters` named no `proposed_date` (NOT NULL, no
  default) and stored NULL in `voting_deadline` (NOT NULL) when the caller gave none, so a reserved matter could never be created.

## The rules, decided from the evidence (not from convenience)

1. A default may not assert a consent or an outcome nobody gave. `mission_audits.impacts_consecutive_compliance` defaults to the conservative `false` (a mission audit does not break the consecutive-compliance streak
   until someone says it does).
2. Where a Drizzle declaration and a Django model both give a default, the database takes it (0073). Where only a Django model gives one on a relation no declaration names, the database takes the model's value unchanged
   (0074): the model is that relation's design.
3. Where the platform declares no default and the Django model does, the Django default is dropped (68 columns): a default the database does not have is a second source of truth. Each NOT NULL column that lost one was
   checked against its writers (`governance_service_views.py` supplies the values; `organizations.hierarchy_path` did break, below).
4. The database may not be stricter than the loosest legitimate writer. `payments.amount` stays nullable on purpose (`NOT_NULL_DELIBERATELY_OPEN`, with the migration that says why).

## What changed

- **Drizzle declarations.** `.notNull()` on the 8 `created_at`/`updated_at` columns of `employers`, `worksites`, `bargaining_units` and `committees`; `.default(false)` on `mission_audits.impacts_consecutive_compliance`
  (both declaration files).
- **Platform migrations** (generated, guarded, fail-closed, reversible, registered UNQUALIFIED): `0072` makes 136 declared columns NOT NULL (a column that holds NULL stops the migration, nothing is invented to fill it);
  `0073` makes 35 declared defaults physical; `0074` makes 35 model defaults physical (a column that already has a default keeps it).
- **Django models** (`manage.py ue_converge_models --drop-defaults`, `--declared-not-null ... --keep-nullable payments.amount`): 68 Django-only defaults dropped, 128 fields tightened; 12 state-only migrations regenerated
  (5,668 operations); `core/model_nullability.json` (4,300 nullable columns) regenerated; `ClcSyncLog.organization` and `GssApplications.met2_week_target` loosened because the table allows it.
- **API surface.** Diffed against the frozen `api_surface.json`: 289 serializers, 71 fields newly required, 1 newly optional (`clc_sync_log.organization`), no readable or write-only change.
- **The reserved-matters route.** The INSERT into `reserved_matter_votes` now writes `proposed_date = NOW()`; the body schema requires a parseable `votingDeadline` (nothing invents a deadline for a vote); the
  governance console refuses an empty deadline; the route's unit test states both columns in the statement.
- **Measurement.** `ue_physical_parity` gained `unbacked_default()` (a model default the column does not have is a strict `DEFAULT_DIVERGES`); `schema-convergence.ts` now judges a declared SQL default physical even when the ORM
  fills it client-side; the generator takes `--kinds=`. Strict parity is 0; `NOT_NULL_ABSENT` is 1 (the deliberate one); the one advisory class left in the parity is `TIMESTAMP_NAIVE` 361.

## Regressions this change caused, found by the suite, and fixed

- Dropping `organizations.hierarchy_path`'s Django default broke the auth webhook's organization creation (17 test errors): `_handle_organization_created` now uses
  `update_or_create(defaults=fields, create_defaults={**fields, "hierarchy_path": []})`, so an existing organization keeps its path and a new one starts empty. Two regression tests.
- `CommunicationPreferencesPhase4.test_create` asserted the dropped defaults (timezone, `email_opt_in`, `sms_opt_in`); it now asserts `None`. Replaced, disclosed here: the defaults were the Django default, not a consent.
- **Eight native test files failed on the first full native run** (not on the 13 targeted tests run earlier): their fixtures inserted rows without columns that 0072 made NOT NULL (`organization_members.name`
  and `email`; `grievances.grievance_number`, `title`, `type`, `description`; `documents.name`, `file_url`, `file_type`, `uploaded_at`; `claim_deadlines.deadline_name`, `deadline_type`, `due_date`, `event_date`,
  `original_deadline`): `authority-kernel-combined`, `message-lifecycle`, `organizations-read-authority`, `platform-directory`, `tenant-isolation-remediation`, `thread-assignment`, `pilot-fixture-bootstrap`,
  `workaid-union-side`. The fixtures now supply the columns the declarations already required; no assertion was weakened. A search of the repository for raw `INSERT`s into the tightened tables found no production writer
  that omits them except two modules that could never run (`db/queries/deadline-queries.ts`, `lib/ingestion/batch-ingest.ts`: their statements name columns the tables do not have; recorded for the raw-INSERT
  tranche); the PGlite tests use their own schemas.

## Verification

- Django: faithful run against the converged database, **1,483 tests OK, 15 skipped** (skips are not passes).
- `tsc --noEmit` clean. A fresh PostgreSQL 16 database built through the real bootstrap; native `platform-0072-0074.postgres.test.ts` (9 tests: 0072 lists its 136 columns, rolls back, re-applies and stops on a NULL
  without inventing a value; the union-structure timestamps and the mission-audits insert behave; 0073 and 0074 give exactly their 35 defaults each and roll back exactly those; 0074 keeps a default someone set and
  refuses a commented column) and `django-model-parity.postgres.test.ts` pass (13 tests together).

## What this does not do

`TIMESTAMP_NAIVE` (361 columns that Django maps naive over a `timestamptz`) is not retyped. The 14 relations that several declarations name differently are not unified. Django `on_delete` against the physical
foreign-key rule is not measured. No HTTP-level proof. Exact-SHA CI for the final head and an independent reviewer are outstanding. No defect or CLOSED credit.

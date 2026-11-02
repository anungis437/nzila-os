# Convergence tranche 8: the Django models equal the physical schema, and the two writers agree

Date: 2026-11-02. Branch `agents/ue-cursor-final-closure`. Base commit `3d92274b4`; source commits `a993155cbf8d38996a91b0cf35c3b71c7768e382` (platform 0070, 0071 and the Drizzle declarations) and `15153ab8cd88cf9787faf0d03b38545a583198dd`
(the Django models, serializers, migration state, tests and CI wiring). Platform migrations `0070_unambiguous_constraints`, `0071_conservative_consent_defaults`.
Credit: none for the tranche itself (cross-cutting source evidence, `defectCredit` 0, `closureCredit` 0). Nothing is closed. `READY_FOR_STAGING` stays `NO`.
This tranche acts on the direction "django and drizzle need to work together in world class manner, hence the convergence exercise; if you identify flaws or missing aspects, fix them too":
tranches 6 and 7 made the Drizzle declarations and the database agree. This one makes the Django models, the API they feed, the migration history and the test suite agree with the same database.

## What was wrong

- **Django could not read or write most of the schema.** Measured by the new `manage.py ue_physical_parity` on the converged database: 1,216 strict findings (1,053 NOT NULL columns without a default that the model does not
  know, so every ORM `INSERT` fails; 157 `null=True` fields over NOT NULL columns; 5 mistyped columns; 1 narrow column) and 4,050 more columns the models did not know. 137 of the unknown required columns, on 46 tables a live
  Django ViewSet can write, were created by this branch's own tranche 6; 320 were older.
- **The migration history disagreed with the models.** `makemigrations --check` exited 1 (about 160 pending operations in 6 apps).
- **The Django suite had never run in CI, and was red.** `manage.py test` aborted on an ImportError (`core/` and `auth_core/` each had a `tests.py` module beside a `tests/` package). Run by explicit module it was 1,321 tests with
  3 failures and 29 errors. No workflow ran Django or pytest at all.
- **A response could publish a whole row.** 289 reachable `ModelSerializer`s (284 with `fields = '__all__'`) and 148 queryset `.values()` calls across 15 routed `services/api` modules return every column of a model. Completing
  a model would have published every new column, including credentials, to endpoints that are `IsAuthenticated` only and scope no tenant.
- **Two writers disagreed about one row.** Found by measuring (details below): five tables carried two foreign keys on one column that no row can satisfy, and 54 columns had a Django default that differs from the column's own,
  so a row written through Django differs from the same row written by anything else.

## What the measurement learned (`backend/core/management/commands/ue_physical_parity.py`)

Strict classes (an ORM operation fails or corrupts data): `TABLE_ABSENT`, `COLUMN_ABSENT`, `TYPE_MISMATCH`, `NARROWER_PHYSICAL`, `NULL_CONTRACT_MISMATCH`, `REQUIRED_COLUMN_UNKNOWN`, `ENUM_MEMBER_ABSENT`, and three added
while the work found their need: `FK_TARGET_MISMATCH`, `DEFAULT_DIVERGES`, `CHECK_REFUSES_CHOICE`. Advisory classes: `TYPE_LOOSE`, `TIMESTAMP_NAIVE`, `NOT_NULL_ABSENT`, `UNIQUE_ABSENT`, `FK_ABSENT`, `CHECK_ABSENT`, `PK_ABSENT`,
`COLUMN_UNKNOWN`.

The measurement was wrong once, and the suite found it. `FK_TARGET_MISMATCH` first kept one foreign-key target per column. Five grievance tables (`grievance_assignments`, `_communications`, `_documents`, `_settlements`,
`_transitions`) carry two: the Django key points at `claims.id`, the declared key (platform 0068) at `claims.claim_id`. `claims.id` and `claims.claim_id` are independent uuids, so no row can satisfy both and none of the five
tables could ever be written. A faithful Django run failed twelve tests for it; the measurement now judges every key on a column and reports the five on the pre-fix database.

## What changed

**Django models (generated, then reviewed).** `manage.py ue_converge_models` edits `models.py`, and is idempotent (a second run finds nothing):

- 5,103 fields added for the columns the models did not know; 157 `null=True` removed where the column is NOT NULL; every enum, array, unbounded numeric and `db_default` expressed (`core/fields.py`: `EnumArrayField`,
  `UnboundedDecimalField`, `UnboundedDecimalSerializerField`; `core/defaults.py`: generated constant defaults);
- 54 defaults converged: 48 in the Django models (37 `default=` corrected, 11 `db_default=` added) and 6 on the platform side (platform 0071), under the rule in "Decisions" below;
- hand fixes where the generator rightly stops: `pilot_applications` arrays are `ArrayField`, `WebhookEvents.id` is a text key, `cba_number` is wide enough, `PushDevices.profile` has no constraint (the table has none), and the
  five grievance `claim` keys name `to_field="claim_id"` (below).

**The API surface is frozen exactly.** Every reachable serializer that said `fields = '__all__'` now lists the fields it produced at HEAD (`core/api_surface.json` pins readable, write-only, required and read-only sets for
all 289; `core/tests/test_api_surface.py`), and nothing is added to any list. Reason: most reachable views are `IsAuthenticated` only with no tenant scoping (`OrgScopedMixin` is used by none of the 289), and an
unknown NOT NULL column is what keeps their create path from writing today; exposing a required column would switch on cross-tenant writes. Exposing a column is a deliberate change to a view, made with the scoping it needs.
The 148 bare `.values()` calls name their columns through `core/api_projection.py` (`api_projections.json`, 87 models, the HEAD projection). Credentials are write-only in every serializer, routed or not (15 serializers).

**Migration history (state only).** `manage.py ue_state_migrations` records the models in 12 generated migrations (5,478 state operations: `*_converge_models_to_physical_schema.py`). They run no DDL, because the platform
migrations own the physical schema and platform 0063 reads current column types (Django runs first, the bootstrap second). Proven below: `migrate` on a clone changes no column, constraint or index.

**Platform 0070 `unambiguous_constraints`** (guarded, reversible, fail-closed; registered UNQUALIFIED):

| what | count | decision |
|---|---|---|
| foreign keys that disagree on one column | 5 | the Django key to `claims.id` is dropped; the declared key to `claims.claim_id` stays |
| the same foreign key twice | 3 (`cba_clauses`, `organization_members`, `strike_fund_disbursements`) | the platform key stays (immediate, `ON DELETE CASCADE`) |
| an index defined twice | 7 groups | the named index or the unique constraint stays; the Django implicit index, or the redundant unique index, goes |
| CHECK constraints added `NOT VALID` and never validated | 2 (`employer_payroll_runs_executor_pair`, `room_bookings_time_order`) | validated against the rows that exist; a violating row stops the migration |

A key or index is dropped only when the one that stays exists, is valid, and (for a key) points where the declaration says; the migration refuses otherwise. The rollback restores each dropped key and index, and refuses to restore
a `claims.id` key over a grievance row that names a `claims.claim_id` value. Two declarations were redundant themselves (`.unique()` and a `uniqueIndex` on `billing_accounts.organization_id` and on
`transaction_fee_events.idempotency_key`); the `uniqueIndex` declarations are removed.

**Platform 0071 `conservative_consent_defaults`** moves six column defaults from `true` to `false` (below).

**Tests and CI.**

- `core/test_runner.py` (`ConvergedSchemaRunner`): `UE_DJANGO_TEST_TEMPLATE=<db>` clones the converged database (faithful; what CI runs); otherwise Django's migrations run and the runner adds the platform's missing columns,
  retypes the few types it retyped, realigns foreign keys, and sets `db_default`s (fast; more lenient than production). It touches only a database it created, and refuses `--parallel` outside faithful mode.
- `core/testing.py` `create_valid`: builds a valid row from the catalog (real foreign keys, CHECK lists and unique keys); 1,635 `X.objects.create(...)` calls in 11 generated test files use it.
- New: `core/tests/test_converged_schema.py` (strict parity, faithful mode), `test_api_surface.py`, `test_custom_fields.py`, `test_pg_literals.py`.
- `db/__tests__/django-model-parity.postgres.test.ts` (native): strict classes zero, `COLUMN_UNKNOWN` zero, advisory ceilings pinned (`TIMESTAMP_NAIVE` 361, `NOT_NULL_ABSENT` 10), `makemigrations --check` clean.
- `db/__tests__/schema-convergence.postgres.test.ts` gains the physical invariant (no column carries two foreign keys, no index is defined twice, no constraint is unvalidated) and the 0070 rollback round trip.
- `.github/workflows/ue-native-postgres.yml` runs the Django suite (`manage.py test --noinput --parallel 1`, then the pytest health contract) against a clone of the converged database after the native results contract.

## Decisions

**Which side of a default is right.** A default may not assert a consent, an outcome or a privacy-invasive processing that nobody gave, evaluated or approved. Six columns broke that rule on the platform side while the
Django models were already conservative: `member_contact_preferences.{email,phone,mail}_opt_in` (pre-ticked consent: CASL and PIPEDA need express consent, Quebec Law 25 asks for the highest confidentiality by default),
`location_tracking_config.location_tracking_enabled` (tracking on by omission) and `separated_payment_transactions.{separation_enforced, correct_account_used}` (an outcome asserted for a transaction nobody checked).
No other writer inserts into the first two tables (`git grep` over TypeScript and SQL), and the payment service sets both outcome columns explicitly, so platform 0071 and the Drizzle declarations move to `false`; existing
rows are never rewritten. Every other divergence (policy toggles that default strict, activity, eligibility and provenance flags, two numeric and text defaults, `feature_flags.tags` `{}` for an array) follows the declared
database default, which is what the Drizzle writers get. The choice is conservative and reversible; the institution may approve otherwise by a later migration.

**Which key survives.** The platform's. The declared key is the Drizzle declaration (`references(() => claims.claimId)`), is immediate and cascades; the Django key was created by Django's default of aiming at the primary key.
The five Django `claim` fields now say `to_field="claim_id"`, which changes the value a client sends for `claim` on those five serializers to `claims.claim_id`; before, any write with `claims.id` violated the declared key anyway.

## Disclosures: what was replaced or changed in existing tests and data

- **Three suites pinned the old state on purpose** and were replaced after the re-review their authors asked for: `unions/tests_round36_reward_containment.py`, `ai_core/tests_round35_ai_budgets_containment.py`,
  `content/tests_round37_social_accounts_containment.py` were designed to trip when the models were regenerated. The containment itself stays (a schema fix proves no consumer and no tenant enforcement); the replacements assert
  containment and the new model shape.
- `billing/tests_request_lifecycle.py` was stale (it called an authentication path that reads `OrganizationMembers`); it now mocks the membership, and a new negative test checks that a principal with no membership is not
  authenticated.
- Eleven generated `test_create` assertions pinned a default of `False` where the column default is `true`; they now assert `True`. A twelfth (`location_tracking_enabled`) stays `False`, because platform 0071 moves
  that column's default to `false`.
- `core/migration_wanted_fields.json` was stale and is regenerated (three `null` flips for the document sensitivity flags). `content/tests_reconciliation_migrations.py` is a `TestCase` (the evidence tables block `TRUNCATE`).
- `core/tests.py` and `auth_core/tests.py` moved to `core/tests/test_models.py` and `auth_core/tests/test_models.py` so the suite can be collected at all.

## Security findings made on the way

- `compliance.BreakGlassActivations` (a contained endpoint) projected `secret_shares` at HEAD. The frozen projection excludes it (`api_projections.json`, `excludedCredentials`).
- 64 call sites in 15 `services/api/*_views.py` modules do `Model.objects.create(organization_id=..., **{k: v for k, v in data.items() if k != 'organization_id'})`: any key in the request body reaches the model. 48 of them
  are in 12 modules that are `IsAuthenticated` only (the other 16 are in three modules already contained by `DenyAllPermission`), and only `governance-service` has a TypeScript consumer. **Not fixed here**; planned as the
  next tranche (contain the viewsets that have no consumer, allow-list the writable fields of the one that has, with tests and the reachability manifest).
- `communication_preferences.newsletter_enabled` and similar channel defaults are `true` in every layer. No layer disagrees, so this is not a convergence defect, but whether a default newsletter or channel consent is acceptable is
  a legal decision, not an engineering one; it is recorded for approval.

## Proof

Run locally on PostgreSQL 16, then on fresh PG15 and PG16 builds and in CI (below).

- `ue_physical_parity --strict` on the converged database: 524 models, **0 strict findings**; advisory `TIMESTAMP_NAIVE` 361 and `NOT_NULL_ABSENT` 10 (pinned). On the database before 0070 the same command reports the 5
  `FK_TARGET_MISMATCH` findings.
- `manage.py check` clean; `makemigrations --check` exits 0.
- **State-only proof:** on a clone of the converged database, `manage.py migrate` took 38 s, applied the 12 generated migrations, and left the catalog digest of 15,815 columns, constraints and indexes identical
  before and after; `migrate --check` exits 0. A fresh `migrate` from nothing takes 53 s.
- **Django suite:** 1,470 tests, `OK`, 15 skipped (pre-existing, each by design) in faithful mode (a clone of the converged database); 16 skipped in fast mode (the faithful-only parity test). Pytest health contract: 7 passed.
- **Platform 0070 and 0071** on a clone: forward, forward again (no change), rollback (the catalog returns to the pre-migration digest, except the two CHECK constraints, which stay validated by design), forward again;
  fail-closed when the surviving key is absent; rollback refuses over a grievance row that names a `claims.claim_id` value.
- **TypeScript:** the unit tests that read the backend and the schema files pass (121 files, 1,651 tests); ESLint and `tsc --noEmit` are clean on the app.
- **Native, fresh PG15 and PG16 builds:** the six native files that touch this work pass (59 tests: `schema-convergence` with the new invariant and the 0070 round trip, `platform-0070-0071`,
  `django-model-parity`, `reachable-stub-shape-2`, `declared-absent-relations`, `schema-convergence-behaviour`); the fresh build's catalog (15,815 columns, constraints and indexes) is byte-identical to the
  template-derived database, so the real bootstrap (Django `migrate`, then the platform migrations through 0071) produces what the proofs above ran against.
- **Exact-SHA CI:** the first head failed one Django test of 1,470 on both versions after the native project and its results contract had passed: `ProjectionsRunAgainstTheDatabase` assumed the converged
  database holds no rows, and the native proofs leave authority fixtures in it. The test now asserts that each projection returns exactly the named columns for whatever rows exist (commit `36d39b349`). On that
  head `Combined Django + Drizzle PostgreSQL 15` and `16` pass: the fresh combined build, every native file in its own clone, the results contract, the 1,470-test Django suite and the pytest health contract,
  with the locked Python and Django versions CI uses.

## What is not claimed

- CI for the final head of the branch is recorded by the ledger, not asserted here (a later head re-runs the whole-application suite and the production-build QA).
- `TIMESTAMP_NAIVE` (361 columns that are `timestamp without time zone` under a `DateTimeField`; correct only for UTC sessions) and `NOT_NULL_ABSENT` (10) remain advisory with pinned ceilings; the next tranche closes them with
  the Drizzle declarations and the 128 NOT NULL columns still open on live Django tables.
- Enabling writes through the frozen serializers is a deliberate future change that needs tenant scoping per view.
- No defect or CLOSED credit, no staging or production claim.

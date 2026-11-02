# Convergence tranche 6: every declaration and the physical database agree

Date: 2026-11-01. Branch `agents/ue-cursor-final-closure`. Base commit `5dfbd4467`; source commit `fea406cbecb65440e10ce2c15bea8e04d9a129d8`. Platform migrations
`0062_declared_enum_convergence`, `0063_declared_shape_convergence`, `0064_declared_unique_keys`, `0065_declared_absent_relations_2`.
Credit: none for the tranche itself (cross-cutting source evidence, `defectCredit` 0, `closureCredit` 0). Nothing is closed. `READY_FOR_STAGING` stays `NO`.
This tranche acts on the direction "address all the missing tables, columns etc.; no freeze, do everything needed, do not be stopped by outdated dispositions": the finance and pension
freeze, the `CONTAINED_DENY_ALL` and `INDIVIDUAL_DECISION` dispositions and the "separate database" boundary no longer keep a relation out of the measurement or the repair.

## What was wrong

Tranches 4 and 5 evolved or created 54 relations, chosen by rule from a census the project kept by hand. The census measured the declarations the barrel (`db/schema/index.ts`)
exports, one per table, and classified three defects. Measured against a database built the way the application builds it (Django `migrate`, then
`tooling/scripts/run-union-eyes-drizzle-bootstrap.mjs`) it left a very large gap:

- **The census saw 568 declared relations. The declaration files declare 623** (267 files under `db/schema`, the barrel, the domain files and 91 flat files, 46 of which application code imports
  directly; 14 physical relations are declared by two to six different, non-identical declarations). A table declared only outside the barrel, or a column only a second declaration names, was never measured.
- **3,342 strict findings** on a fresh PG16 built from `5dfbd4467`: 2,343 declared columns that do not exist; 719 NOT NULL columns with no database default for which the ORM emits `DEFAULT`
  (so every insert that leaves them out fails); 46 declared defaults the database does not have (the row is stored with NULL, silently); 114 NOT NULL columns no declaration names
  (every insert through any declaration fails) and 4 declared nullable that the database requires; 88 declared unique keys with no unique index (`ON CONFLICT` cannot infer them, and the key is not unique);
  8 columns narrower than declared (one drops the last two decimals of a per-capita rate); 5 columns of the wrong type; 1 enum type missing 3 members the grievance conversion writes; 14 relations no migration creates.
  The plain-`select()` probe over the barrel failed for 167 of 568 declared tables.
- Defects the shape hid, each found by running the unmodified code on the real schema:
  - `POST /api/gdpr/cookie-consent` answered 500 to every visitor, anonymous or not. The route saves as the system role, which holds no privilege on `cookie_consents` (the manifest said the tenant
    runtime role did the write) or on `profiles`; and `cookie_consents.user_id` is a foreign key to `profiles(id)`, while the declaration called it text naming `profiles.user_id` and the route stored the
    session's identity string.
  - Converting an intake to a case (`POST /api/grievances/[id]/convert`) writes an array to `grievances.related_grievance_ids`, which the declaration called `uuid[]` and the database stores as `jsonb`:
    `22P02` on every call. It also records the events `intake_submitted`, `converted_to_case` and `priority_overridden`, which the database enum type `grievance_event_type` did not have.
  - `webhook_events.id` is a uuid in the database and the primary key the webhook router fills with the provider's own event id (`evt_...`): every webhook insert failed.
  - 33 whiplash-prevention, firewall and payment-routing columns (ids and the foreign keys between them) are uuid in the database and text in the declarations, whose ids are cuid2 values a uuid column refuses.
  - `pilot_applications` stores four arrays in `text` columns (the literal `{a,b}`), and `federation_remittances.per_capita_rate` is `numeric(19,2)` where the declaration says `numeric(10,4)`.
  - `audit_security.failed_login_attempts` declares `CHECK (attempted_at > NOW() - INTERVAL '30 days')`: a check on `NOW()` is evaluated only when a row is written, would reject an archived row on
    restore, and is not a constraint at all.
  - The three finance statements the earlier ratchet pinned as "finance freeze" (`ANY(${array})` in the CLC remittance export, arrears processing and the accounting invoice sync) failed on every call.

## What changed

- **The measurement.** `apps/union-eyes/scripts/runtime/schema-convergence.ts` replaces the hand-kept census as the definition of "converged". It imports every declaration file (barrel first), merges
  the declarations of one physical relation (a column is only as strict as its loosest declaration: NOT NULL only if every declaration says so, a default if any does), and compares the result with the
  database (`information_schema`, `pg_constraint`, `pg_index`, `pg_enum`, `pg_extension`). Strict classes: `TABLE_ABSENT`, `MISSING_COLUMN`, `TYPE_MISMATCH`, `NARROWER_PHYSICAL`, `NO_DB_DEFAULT`,
  `DEFAULT_ABSENT`, `NULLABLE_DECLARED_BUT_REQUIRED`, `UNDECLARED_REQUIRED`, `UNIQUE_ABSENT`, `ENUM_MEMBER_ABSENT`, `SHAPE_CONFLICT`. Advisory (pinned ceilings, may only shrink): `FK_ABSENT`,
  `INDEX_ABSENT`, `NOT_NULL_ABSENT`, `CHECK_ABSENT`, `TZ_MISMATCH`, `SHAPE_DRIFT`, `VARIANT_REQUIRED`, `EXTENSION_ABSENT`. `scripts/runtime/orm-physical-parity.ts` is now its command line
  (`--json`, `--strict`, `--write=<register>`).
- **The generator.** `apps/union-eyes/scripts/generate-declared-convergence.ts` turns a register of findings into reviewable, guarded, reversible SQL. `generate-relation-create.ts` now handles
  schema-qualified relations (`audit_security.*`, `user_management.*`) and writes the file itself (`--out`, LF endings).
- **Platform 0062 `declared_enum_convergence`** (+ rollback). 40 enum types created and the 3 missing `grievance_event_type` members added. A member PostgreSQL has just added cannot be used in the
  same transaction, so this is its own migration and runs first.
- **Platform 0063 `declared_shape_convergence`** (+ rollback). 246 relations. Adds the 2,343 declared columns (nullable unless a SQL default makes NOT NULL safe; NOT NULL afterwards only where the
  relation holds no rows), sets 765 declared defaults on columns that had none, gives the 118 NOT NULL columns no declaration can fill the Django base default (uuid `id`/`event_id`, `created_at`, `updated_at`)
  or drops their NOT NULL, widens 8 columns (never narrows), retypes 5 columns losslessly (`uuid` to `text` for the provider-keyed `webhook_events.id`, `text` to `text[]` for four arrays), and creates the
  pgvector column only where the server offers the extension (a notice otherwise). A preflight and a postflight prove that no constraint, index, policy, grant or row-security setting of any relation changed.
  Every column, default and relaxation is tagged `platform-migration:declared-shape-convergence[:default|:relax]`; the rollback removes exactly those, restores NOT NULL only where no NULL has since been stored,
  and does not reverse widenings, enum members or retypes (narrowing could truncate data, and PostgreSQL cannot remove an enum member).
- **Platform 0064 `declared_unique_keys`** (+ rollback). 88 unique constraints, each refused when the relation already holds duplicates, each tagged for rollback.
- **Platform 0065 `declared_absent_relations_2`** (+ rollback). The last 14 relations no migration created: `usage_aggregates`, `usage_events`, `usage_meters`, `dunning_cases`, `dunning_policies`,
  `dunning_steps`, `fee_settlement_lines`, `pricing_discount_rules`, `pricing_regional_deployments`, `pricing_template_modules`, `pricing_templates`, `audit_security.failed_login_attempts`,
  `audit_security.rate_limit_events`, `user_management.oauth_providers`. Every privilege is revoked until the manifest grants it; all eleven public relations are `LATENT_UNREACHABLE` there and stay closed.
- **Declarations corrected** (the declaration was the wrong side): 62 text columns that are uuid in the database retyped to `uuid` (the cuid2 defaults of the 32 primary keys replaced by the database
  uuid default; `webhook_events.id` stays text and the database side is retyped); `grievances.related_grievance_ids` is `jsonb` of string ids; `cookie_consents.user_id` is `uuid` referencing
  `profiles.id`; the time-dependent CHECK is gone; four columns take the Django name (`address_line1`, `met2_week_target`, `allow_greivance_participation` and the `signatureN_*` series) so one attribute
  has one column; four variant declarations of `chart_of_accounts`, `clc_sync_log`, `clc_webhook_log` and `newsletter_list_subscribers` stop contradicting the others' types.
- **Code.** `CookieConsentManager.saveCookieConsent` stores the profile uuid of a signed-in visitor (an anonymous visitor, or one with no profile row, is stored with a null user) and keeps its
  ownership rules; the manifest gives the system role the privileges the public route needs (`cookie_consents` SELECT, INSERT, UPDATE; `profiles` SELECT; the system role already carried the full-access
  policy on both) and the catalog authority contract is regenerated. The three finance statements use `inArray` and `sqlIn`, and the freeze pins leave `lib/db/__tests__/array-parameters.test.ts`.
- **Registers.** The canonical schema census goes from 179 entries to 0 (the committed baseline is regenerated and its dispositions and mutation-batch program with it; `knowledge_base.embedding` is
  not a gap on a server without pgvector); the canonical manifest and oracle are republished (378 tables verified); the census pins in the Gate 0 tests and the completion register are updated. The evidence input the
  migrations were generated from is `evidence/ue-declared-convergence-input-20261101.json` (sha256 prefix `ad12b6ed1efc9caa`, recorded in each migration header).

## Measured

Fresh PG16 and PG15 databases built from the shipped files ("Bootstrap complete", migration ledger integrity verified, authority reconciliation `PHYSICAL_SCHEMA_VERIFIED SECURITY_EFFECTS_VERIFIED`).

| | before (`5dfbd4467`) | after |
|---|---|---|
| declared relations measured | 555 (barrel) / 623 (all) | 623, every one present |
| strict findings | 3,342 | 0 |
| plain `select()` over the barrel's declared tables | 167 of 568 fail | 1 of 568 fails: `knowledge_base.embedding` on a server with no pgvector |
| canonical schema census | 179 entries | 0 |

Advisory classes after (pinned ceilings in `db/__tests__/schema-convergence.postgres.test.ts`): `FK_ABSENT` 370, `INDEX_ABSENT` 794, `NOT_NULL_ABSENT` 286, `TZ_MISMATCH` 420, `CHECK_ABSENT` 36,
`SHAPE_DRIFT` 13, `VARIANT_REQUIRED` 19, `EXTENSION_ABSENT` 1.

Forward, rollback and forward again (all four migrations, in a clone of the converged database): strict findings return to the pre-migration counts except the non-reversible ones, then close again with the same
advisory counts.

## Authority

No relation gains a grant from the shape migrations, and no policy or privilege changes there (the postflight enforces it). Two manifest entries change, both for the public cookie-consent save, which has no
tenant session and therefore runs as the system role: `cookie_consents` (system SELECT, INSERT, UPDATE; `MIXED`) and `profiles` (system SELECT; `MIXED`). The 14 new relations are closed to both roles.

## Tests

- `db/__tests__/schema-convergence.postgres.test.ts` (native PG15 and PG16): every declared relation is measured; no strict finding; each advisory class at or below its ceiling and no unclassified class;
  migrations 0065 to 0062 roll back and 0062 to 0065 apply again.
- `db/__tests__/schema-convergence-behaviour.postgres.test.ts` (6): an insert that omits id, timestamps and defaults succeeds; a duplicate of a declared unique key is refused and `ON CONFLICT` infers it; a
  provider event id is stored as text; a `text[]` declaration round-trips through a `text[]` column; the widened column accepts what is declared.
- `db/__tests__/cookie-consent-route.postgres.test.ts` (5): the unmodified route as the real roles.
- Updated: `db/__tests__/schema-mutation-batches.test.ts` (each of the 178 census exits tied to the migration that earned it), `canonical-schema-census.postgres.test.ts`, the round-47 manifest test,
  `lib/gdpr/__tests__/consent-manager.test.ts`, `lib/db/__tests__/array-parameters.test.ts`, the three Gate 0 pin tests, and `db/__tests__/reachable-stub-shape-2.postgres.test.ts`, which now rolls the
  later shape migrations back first (0063 gives columns the enum types that 0060 created, so rolling 0060 back alone leaves them in use).
- **The whole native project, CI-faithful** (fresh Django + Drizzle build, each test file in its own clone, `--maxWorkers=1`, then `tooling/scripts/lib/ue-native-results-contract.mjs`), on the final tree:

  | | files | tests | passed | failed | skipped | contract | leaked clones |
  |---|---|---|---|---|---|---|---|
  | PG15 | 57 | 592 | 591 | 0 | 1 (by design) | exit 0 | none |
  | PG16 | 57 | 592 | 591 | 0 | 1 (by design) | exit 0 | none |

  The first PG16 run, before the `reachable-stub-shape-2` correction, had exactly two failures, both in that file; they are the reason for the correction.

## Found, not fixed here

- **Fourteen relations are declared by more than one non-identical declaration** (`chart_of_accounts`, `clc_sync_log`, `clc_webhook_log`, `automation_rules`, `reward_wallet_ledger`, `communication_preferences`,
  `consent_records`, `dues_transactions`, `payments`, `payment_methods`, `gl_account_mappings`, `ml_predictions`, `insight_recommendations`, `newsletter_list_subscribers`), some of which are two features that
  collided on one table name (the reward-automation rules and the workflow-automation rules are both `automation_rules`). The database now satisfies the union of their columns, none of it NOT NULL that a
  declaration omits; 19 NOT NULL columns that some declarations omit are reported as `VARIANT_REQUIRED` and cannot be closed in the database without loosening a real constraint. They need one declaration each
  and, for the collisions, a renamed table: a product and code decision per relation.
- **Foreign keys (370), indexes (794), declared NOT NULL (286), `timestamp` without time zone over a `timestamptz` column (420) and checks (36)** are measured and pinned, not yet closed.
- The pgvector column. A server without the extension has no `knowledge_base.embedding`; `app/api/ai/summarize` reads every column of that table and `lib/ai/template-engine.ts` searches by vector.
  Where the extension exists the migration creates the column; the readers do not yet cope with its absence.
- Reachability: the 11 public platform-economics relations are classified `LATENT_UNREACHABLE` ("no real callers") while the census marked 22 routes as reaching them; those routes have not been run against the
  real tables, so nothing is claimed for them.

## What this does not do

It does not close any defect or reach CLOSED, and it does not make any statement about staging or production. Shape agreement does not give a route authority: the 116 relations the manifest still
contains as deny-all keep no grants, and a route over one still answers 500 until its authority is decided and proven natively.

## Reproduce

```
# a database built the way the application builds it
Django migrate, then node tooling/scripts/run-union-eyes-drizzle-bootstrap.mjs
cd apps/union-eyes
DATABASE_URL=... npx tsx scripts/runtime/orm-physical-parity.ts --strict        # exits 1 when any strict class is present
DATABASE_URL=... npx tsx scripts/runtime/orm-select-probe.ts
UE_NATIVE_TEMPLATE_URL=... npx vitest run -c vitest.native.config.ts db/__tests__/schema-convergence.postgres.test.ts
# regenerate from a database built from the previous head
DATABASE_URL=... npx tsx scripts/runtime/orm-physical-parity.ts --strict --write=<register.json>
npx tsx scripts/generate-declared-convergence.ts --register=<register.json> --label=declared-shape-convergence --out=db/migrations-platform/0063_declared_shape_convergence.sql
```

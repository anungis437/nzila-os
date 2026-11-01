# Convergence tranche 4: the reachable stub relations take their declared shape

Date: 2026-11-01. Branch `agents/ue-cursor-final-closure`. Base commit `c0b97cfc9`. Platform migration `0060_reachable_stub_shape_2`.
Credit: none for the tranche itself (cross-cutting source evidence, `defectCredit` 0, `closureCredit` 0). The follow-up below (ledger B129) clears the remaining item recorded against one defect
that was already counted as implemented pending qualification, so no count changes (652 corrected, 72 partial, 125 unresolved); nothing is closed. `READY_FOR_STAGING` stays `NO`.

## What was wrong

Django creates a number of relations as stubs, and the Drizzle declarations the application reads and writes name many more columns. On a database built the
way the application builds it (Django `migrate`, then `tooling/scripts/run-union-eyes-drizzle-bootstrap.mjs`), a plain `select()` through such a declaration
fails with `42703` (undefined column), and an insert through it fails where Django left `id`, `created_at` or `updated_at` without a database default.
The convergence program had classified most of these as deliberately not evolved (global reference data, system-only relations, individual decisions).
Each of the thirteen is reachable from an App Router entry, so each is a route that fails at runtime on a real database.

## What changed

- `apps/union-eyes/db/migrations-platform/0060_reachable_stub_shape_2.sql` and `.rollback.sql`. Thirteen relations: `alert_rules`, `arbitration_decisions`,
  `automation_rules`, `case_studies`, `clc_organization_sync_log`, `cost_of_living_data`, `external_data_sync_log`, `provincial_privacy_config`,
  `reserved_matter_votes`, `support_tickets`, `union_density`, `wage_benchmarks`, `webhook_receipts`.
  - Chosen by rule, not by hand: reachable from an App Router entry, Django-defined, a plain select fails with `42703`, no individual decision pending,
    not finance-frozen, not `location_tracking_config` (another change owns it). Left out for their own reasons: `knowledge_base` (pgvector), `consent_records` and
    `user_consents` (an enum name declared with different members), `social_campaigns`, `integration_sync_log`, every contained deny-all relation, every
    relation that does not exist (nothing is invented).
  - Additive only. 208 declared columns are named; 205 are missing on a freshly built database (three on `arbitration_decisions` come from platform 0051), each
    added nullable with its declared default. 14 enum types are named; 11 are created (three already existed with exactly the declared members, and a mismatch fails
    the migration). `id`, `created_at` and `updated_at` get their default only where they had none. NOT NULL is applied only where the relation holds no rows.
    No foreign key, index, grant, policy or row is created, changed or seeded.
  - Guarded. The migration snapshots each relation's constraints, indexes, policies, table grants, column grants and row-security flag before it alters anything and
    fails the transaction if any of them differs afterwards, or if an existing column has another type than its declaration. Every column and enum type it adds is
    tagged `platform-migration:0060_reachable_stub_shape_2`, and the rollback removes exactly the tagged ones (plain `DROP COLUMN`, no `CASCADE`, so a later dependent
    object stops it instead of being dropped). The defaults on `id`, `created_at` and `updated_at` stay on rollback, and the file says why.
  - Registered `UNQUALIFIED` in the journal, the approved lineage (sha256 bound) and the README. The catalog authority contract is unchanged (regenerating it gives
    no diff), because the migration grants nothing.
- `apps/union-eyes/scripts/generate-stub-evolution.ts`: `--guard=<label>` and `--rollback=<label>`. The migration header records the census revision it was
  generated from, because the generator reads the committed census and the census shrinks as relations are evolved.
- `apps/union-eyes/scripts/runtime/orm-select-probe.ts`: the runtime probe used for the measurements below, so the numbers can be reproduced.

## Measured

Both databases were built from scratch from the shipped file (PG16 `ue_final_16`, PG15 `ue_final_15`; "Bootstrap complete", migration ledger integrity verified,
111 rows). The baseline is a database built the same way at `c0b97cfc9` before 0060 (`ue_fresh16`).

| Measure | Before 0060 | After 0060 |
| --- | --- | --- |
| Plain `select()` through a declaration fails (568 declared tables) | 203 | 190 |
| Reachable and failing | 78 | 65 (32 undefined column, 33 undefined relation) |
| Parity findings (`orm-physical-parity.ts --json`) | 2,758 | 2,519 |
| `MISSING_COLUMN` | 2,080 | 1,875 (-205) |
| `NO_DB_DEFAULT` | 644 | 610 (-34) |
| `TYPE_MISMATCH` | 34 | 34 |
| Divergent tables | 215 | 202 |

All thirteen relations have zero findings afterwards, and nothing outside them changed (no finding gained or lost elsewhere).

## The census exits, and which of them 0060 earns

`ue-canonical-schema-census.json` went from 231 to 202 entries. Computed against the baseline database, the committed census was already stale for 16 of the 29 exits:

- 13 exits are caused by 0060, and they are exactly the thirteen relations (the set difference between the census of the baseline database and the census after 0060).
- 9 exits are entries for declarations that were already retired from the schema barrel and still sat in the committed census: `bank_accounts`, `bank_reconciliations`,
  `clc_remittance_mapping`, `erp_invoices`, `grievance_timeline`, `notification_history`, `org_usage`, `signature_templates`, `signature_webhooks_log`.
- 7 exits were already evolved by earlier registered migrations and never removed: `data_anonymization_log`, `employment_history`, `job_classifications` and `member_leaves`
  (platform 0031), `committee_memberships` (platform 0039), `room_bookings` (platform 0041), `feature_flags` (cache 0031).

0060 is credited with the 13, and the other 16 are recorded as stale-baseline corrections, not as work of this change. Nothing was gained and no column regressed against the
committed baseline. The disposition register and the derived batch program were regenerated from it (231 to 202; four batches that emptied no longer appear).

## Authority

The migration changes no access. This is shown three ways: the guard inside the migration; the native test, which snapshots constraints, indexes, policies, `relacl`,
column ACLs and the row-security flag before and after applying it again and after a rollback and re-apply; and a regenerated catalog contract with no diff.
The roles keep exactly what the manifest gave them (the privilege mix differs per relation, for example `external_data_sync_log` is insert-only for both roles),
and the test reads as each role only where it holds `SELECT`.

## Tests

New: `apps/union-eyes/db/__tests__/reachable-stub-shape-2.postgres.test.ts`, 16 tests on PG15 and PG16 (every change inside a transaction that is rolled back):
every declared column exists and a plain select works; the base defaults exist; the real roles read where granted; applying again changes nothing; the rollback removes
exactly what was added and re-applying restores the same shape; a populated relation keeps its new columns nullable and an empty one gets NOT NULL; and the guard fails closed for an added
table grant, column grant, constraint, index and policy, for a switched row-security flag, for an existing column of another type, for an enum of the same name with other members, and for
a missing relation. On the baseline database the same file fails with the original defect (205 declared columns missing, and `union_eyes_system cannot read reserved_matter_votes`).
The census ratchet (`canonical-schema-census.postgres.test.ts`) passes in verify mode on both versions.

Existing tests I changed, because the regenerated census invalidates what they pinned (the intent of each is kept):

- `db/__tests__/schema-mutation-batches.test.ts`: the pins on the four batches that emptied (retire-declaration 3, live-unreferenced 5, verify-dead-module 1, evolve-reachable 6)
  and on `censusCount` 231 are replaced by an assertion that those batches carry no row, `censusCount` 202, and a new test, "explains every table that left the census", which ties every
  exit to a retired declaration (absent from the barrel) or to an `ALTER TABLE` in a named registered migration and requires the explained count to equal 231 minus the census size.
  Every other pin in the file is unchanged.
- `db/__tests__/schema-retire-declaration.test.ts` and `db/__tests__/schema-live-unreferenced.test.ts`: they asserted that a retired declaration still has its census row. They now assert the
  rows and dispositions have left, and the eight retained relations are still listed.
- `tooling/scripts/lib/ue-gate0-scope-lock.test.mjs`, `ue-gate0b2-classification.test.mjs`, `ue-gate0b3-classification.test.mjs`: `censusCount` 231 becomes 202, and the committed Gate 0 matrix
  has the same four census fields edited (the number, two sentences of prose that quoted it, and a sentence that said remediation "has not started"). `ue-gate0-build-matrix.mjs` now writes that
  prose from the live count. The matrix was edited by hand because regenerating it wholesale also rewrites unrelated anchored content (route operations 1,646 to 1,656, lifecycle downgrades);
  that was reverted.
- `docs/union-eyes/convergence/register/ue-convergence-ratchets.json`: removed a stale `MUTABLE-REP-IDENTIFIER` allowlist entry (`app/api/grievances/[id]/convert/route.ts` no longer contains the pattern), which
  the convergence checker had been reporting as stale. The checker passes with 24 matching and 24 allowlisted.

## Found, not caused by this change, not fixed here

`tooling/scripts/lib/ue-gate0-scope-lock.test.mjs` "the committed matrix matches the live inventories" reports one problem: a Gate 0 route-classification record quotes
`if (!secretsEqual(cronSecret, expected)) {` from `lib/api/with-api.ts`, a line the F01 scheduled-jobs change (`8022161d6`) replaced. No workflow in `.github` runs these `.mjs` tests. The classification record is a
frozen assessment of the code as it was; rewriting its quote would make a stale assessment look current, so that needs a decision on re-anchoring, not an edit.

## What this does not do

- It does not touch the 202 remaining census entries or the 65 reachable declarations that still fail: 33 are relations Django never created (the capability must answer 501, not 500), and 32 are
  contained deny-all, individual-decision (pgvector, an enum name declared with different members), finance-frozen or owned by another change.
- It does not qualify the migration on a staging clone. It is `UNQUALIFIED`.

## Follow-up in the same pull request: the precedent library on the converged table

The one defect whose recorded remaining item concerned this shape, `DEF-0B3-ARBITRATION-DECISIONS-NON-PUBLIC-READABLE-CROSS-TENANT`, had been waiting for the shape and for proof that the library works
against a real database. `db/__tests__/precedent-library.postgres.test.ts` (14 tests, PG15 and PG16, re-runnable, leaves nothing behind) runs the unmodified `precedent-service` and the unmodified
collection and item routes of `arbitration/precedents` against the converged real table, over eight decisions (public, private, restricted, pending review, owned by two organizations and by nobody).
Reads go through the tenant runtime role with no organization (as the service's ambient handle does in production, set by a connection-level `role` option so row-level security applies), writes
through the tenant transaction. It proves, with the expectations stated independently of the code under test:

- every service read (by id, by case number, list with paging, sort and filters, search, issue type, related, statistics, most cited) returns exactly the public unrestricted decisions, with the intended ordering;
- both routes list the same set and report a private, restricted, pending-review or ownerless-private decision as not found, even to its owner;
- the row-level-security floor agrees (a tenant reads what is public and unrestricted plus what it supplied), and refuses a tenant an insert owned by another organization or by nobody (`42501`) and
  an update or delete of what it does not own;
- a decision is created owned by the supplying organization, not public and pending review, whatever the caller sends, and only that organization changes or deletes it.

Run against the real table it failed before it passed, and the failures were three defects in `precedent-service.ts` that no unit test could show, because they depend on the real column types:

- `searchPrecedents`, `getPrecedentsByIssueType` and `getRelatedPrecedents` ordered by `precedent_value DESC`. The enum sorts as declared (high, medium, low), so the least valuable decision came first.
  They now order by an explicit rank.
- `getRelatedPrecedents` used `jsonb && jsonb`, which PostgreSQL does not have (`operator does not exist: jsonb && jsonb`), and cast a JavaScript array bound as one parameter to `jsonb`
  (`invalid input syntax for type json`), so it threw for every decision that had issue types. It now asks, per issue type, whether it is an element of the stored array. A decision with no issue type
  and no sector now relates to nothing, instead of to every readable decision.

The role floor (`readRole`, the session) is outside this test, because the wrapper is replaced; the generic POST over this table, which has no owner to write, is a separate defect. This is the
proof the ledger item named, so B129 clears that item's remaining text and records the defect as implemented pending qualification with nothing outstanding in source. It is not closed: nothing here is a
staging, browser or independent-reviewer result.

## Reproduce

1. Build a database: in `apps/union-eyes/backend` run `python manage.py migrate --noinput`, then from the repository root run `node tooling/scripts/run-union-eyes-drizzle-bootstrap.mjs`
   with `DATABASE_URL`, `SYSTEM_DATABASE_URL` and `PLATFORM_DATABASE_URL` set to that database, `QA_TEST_ENV=true`, `UE_ENVIRONMENT=local` and `UE_CANONICAL_BOOTSTRAP_V2=0`.
2. From `apps/union-eyes`: `DATABASE_URL=... npx tsx scripts/runtime/orm-select-probe.ts` and `DATABASE_URL=... npx tsx scripts/runtime/orm-physical-parity.ts --json`.
3. `UE_AUTHORITY_COMBINED_URL=... npx vitest run -c vitest.native.config.ts db/__tests__/reachable-stub-shape-2.postgres.test.ts db/__tests__/precedent-library.postgres.test.ts` and, with `UE_CENSUS_URL=...`,
   `db/__tests__/canonical-schema-census.postgres.test.ts`.

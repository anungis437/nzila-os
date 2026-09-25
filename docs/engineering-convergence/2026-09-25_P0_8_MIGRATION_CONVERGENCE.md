# P0.8 Migration Convergence

**Baseline:** `abc7e07bae4b11fcaf9c4d51a2245758ad31e9d8`

**Inspected lanes:** LANE-003, LANE-004, LANE-011, LANE-012, LANE-024

**Ruling:** `MIGRATION_LINEAGE = RECONCILIATION_REQUIRED`

This is a planning ruling, not permission to apply migrations. It records the
single intended ownership model before the schema replacement lane is built.
No database or Azure resource was changed during this review.

## Canonical ownership model

Union Eyes is intentionally multi-lineage, but each physical table has exactly
one schema owner:

1. Django migrations own Django canonical business tables.
2. Scoped SQL under `apps/union-eyes/db/migrations-cache/` owns only its
   declared cache, RLS, and runtime-support concerns.
3. Post-freeze platform SQL may create genuinely platform-owned business
   tables after explicit ownership registration. It must not patch a
   Django-owned table.
4. The frozen legacy `apps/union-eyes/db/migrations/` lineage remains evidence
   and bootstrap history. It is not replayed by the current bootstrap runner.
5. Root governed SQL remains governed by its existing indexes/contracts and
   does not become an escape hatch around table ownership.

The current bootstrap source already says that it does not mutate Django-owned
tables. PR #796 makes that rule executable through a schema-authority registry,
fresh-build guard, runtime contract, and deterministic tests. That foundation
must land before a replacement for PR #799.

## Current-main lineages

At the inspected baseline, the repository contains:

| Lineage | Count | Current role |
| --- | ---: | --- |
| Django app migrations | 26 Python migrations across 13 apps | Canonical business entities |
| `apps/union-eyes/db/migrations/` | 108 SQL files | Frozen legacy lineage |
| `apps/union-eyes/db/migrations-audit/` | 5 SQL files | Audit-scoped lineage |
| `apps/union-eyes/db/migrations-cache/` | 22 SQL files | Scoped cache/RLS/runtime support |
| root `migrations/` | 30 SQL files | Governed cross-cutting SQL |

PR #796's proposed registry currently classifies 11 tables as
`DJANGO_CANONICAL`, three as `EXTERNAL_READONLY`, and one as `PLATFORM_AUTH`.
Its registry is the ownership foundation, not a claim that only those fifteen
tables exist.

## LANE-003 ruling

PR #796 is the first integration dependency. Its Django migrations are the
accepted ownership path for:

- `organization_members` additions in `auth_core/0005`;
- `documents` additions in `content/0004`;
- `claims.idempotency_hash` in `grievances/0005`.

The exact column set still has to pass the registry's own fresh-build and
runtime-contract checks after rebase. In particular, the registry identifies
the `claims` dual Drizzle declaration and pending `documents` model
confirmation; those are explicit convergence work, not reasons to bypass
Django with SQL patches.

## LANE-004 platform SQL ruling

PR #799 proposes a new `migrations-platform` lineage. Each migration has the
following disposition:

| Migration | Disposition | Reason |
| --- | --- | --- |
| `0001_billing_subscriptions.sql` | `CANDIDATE` | Forward-only table creation; register owner and compare with all existing declarations before acceptance |
| `0002_employer_execution_and_related_a.sql` | `CANDIDATE_SPLIT` | Creates 15 tables spanning employer execution, CBA, break, and survey domains; each table needs an explicit owner and the file should be split by bounded ownership/domain |
| `0003_integration_partners_and_security_posture.sql` | `CANDIDATE_SPLIT` | Two distinct domains; register and split unless one owner is deliberately established |
| `0004_audit_gap_canonical_tables.sql` | `CANDIDATE_REBUILD` | Creates 24 broad product tables from an audit gap; no bulk acceptance until every table is reconciled to its source model and owner |
| `0005_organization_members_deleted_at.sql` | `REJECT_AS_WRITTEN` | Mutates a Django-owned table and conflicts with LANE-003's `auth_core` migration |
| `0006_documents_runtime_columns.sql` | `REJECT_AS_WRITTEN` | Mutates a Django-owned table and conflicts with LANE-003's `content` migration |
| `0007_claim_updates_runtime_columns.sql` | `BLOCKED_OWNER_DECISION` | `claim_updates` is absent from the proposed authority registry; ownership and physical shape must be adjudicated first |

`0001` through `0004` are preservation candidates only. Their use of
`CREATE TABLE IF NOT EXISTS` does not prove correct ownership, column shape,
constraints, or compatibility with a clean build.

PR #799's deterministic platform journal and refusal of out-of-order targeted
application are useful implementation components. They may be carried into the
replacement only after the accepted migration set is rebuilt.

## Scoped and stashed migration ruling

- PR #799 `migrations-cache/0014_lineage_restoration_rls_closure.sql` is a
  candidate RLS closure, but it must be regenerated against the accepted
  clean-room table set after LANE-003 and the rebuilt platform lineage.
- LANE-011's local
  `0006_protect_workbook_claim_credentials.sql` is rejected. Current main's
  credential/payment authority migration is stronger; the local file would
  create weaker duplicate history.
- LANE-012 stash 3 migrations `0048` and `0049` remain component-review
  candidates. They introduce deadline reassignment vocabulary and assignment
  continuity outbox storage and require current authority, retention, and RLS
  review before a new migration is authored.
- LANE-024 stash 25 `0006_schema_alignment.sql` and
  `0007_create_all_tables.sql` are historical inputs only. The broad ALTER and
  68-table create-all approach conflicts with the one-owner model and must not
  enter the canonical lineage.

No historical stash migration should be applied directly. Accepted behavior
must be re-authored as the next migration in the final owning lineage.

## Required integration sequence

1. Rebase LANE-003 and make the ownership registry, Django migrations,
   fresh-build guard, runtime contract, and RLS-context tests green together.
2. Add every proposed platform table to the ownership registry and reject all
   dual-owned or unowned tables.
3. Rebuild LANE-004 platform SQL as small, owner-bounded migrations. Do not
   carry `0005` or `0006`; do not carry `0007` until `claim_updates` has an
   owner.
4. Run an empty-database build in the canonical order: Django canonical
   migrations, accepted scoped migrations, then accepted platform creations.
5. Generate the runtime-schema oracle from that database and require zero
   missing required tables, zero unowned required tables, and zero dual-owned
   required tables.
6. Regenerate the RLS closure and prove policy coverage against the same exact
   schema and commit.
7. Regenerate all schema reports and staging evidence. Evidence from PR #799's
   old head remains historical and cannot certify the replacement head.

## Exit conditions

P0.8 can change to PASS only when all of the following are true:

- `claim_updates` has one registered owner and one accepted physical shape;
- every `migrations-platform` table has an explicit owner;
- no platform migration mutates a Django-owned table;
- the clean build and snapshot-restore paths converge to the same schema;
- migration journals reject hash drift and out-of-order application;
- runtime-schema and RLS checks pass on the exact replacement head.

Until then, schema work is accounted for but not converged. This keeps Gate A
closed without discarding the valid implementation and evidence work in
LANE-003 and LANE-004.

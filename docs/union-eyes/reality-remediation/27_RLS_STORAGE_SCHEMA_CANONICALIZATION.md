# 27 — RLS Storage-Authority Manifest: Schema Canonicalization Findings

Status: IN PROGRESS. Companion to `26_UE_PHASE3A_RUNTIME_ACCEPTANCE.md` and
PR #752 (`fix/ue-runtime-rls-foundation`). Not the whole of #752's RLS scope
by itself, but a **real, disclosed, separate finding** that must not be
silently dropped. Updated 2026-09-01 (round 2) after independent review
found the first-round scanner overstated compatibility and asked for
`grievance_documents` to be fully remediated, not just documented.

## What was found (round 1)

While classifying `grievance_documents` in
`apps/union-eyes/db/rls-storage-authority-manifest.ts`, three different
schema files were found declaring `pgTable("grievance_documents", ...)` for
the same physical Postgres table, with genuinely different column sets. A
repo-wide scan (`apps/union-eyes/scripts/schema-duplicate-table-scan.ts`)
found 22 more physical tables with the same class of collision.

## Round 2 correction: the scanner itself understated risk

The round-1 scanner called two declarations "COMPATIBLE_DUPLICATE" whenever
they shared the same set of column **names**, without checking type,
nullability, default/generated semantics, PK/unique participation,
array-ness, or FK target. Two declarations can share every column name and
still disagree on what those columns mean — that is not proven
compatibility. The scanner now uses three states and never claims
compatibility it hasn't actually checked:

- **`CONFLICTING_SCHEMA`** — column names differ, or an extractable
  property (type-function identifier, `notNull`, `primaryKey`, `unique`,
  array-ness, default presence, or a fully-resolved FK target) genuinely
  disagrees for a same-named column.
- **`IDENTICAL_OR_PROVEN_COMPATIBLE`** — column names match and every
  extractable property agreed for every column in every declaration.
- **`SAME_COLUMN_SET_UNVERIFIED`** — column names match, nothing
  extractable disagreed, but at least one property could not be confidently
  extracted (e.g. only one side has a detectable FK reference) — so
  compatibility is "not disproven", not "proven".

The scanner also now:

- **Checks the actual imported export name**, not just the module path,
  when flagging a "direct import bypassing barrel". Round 1 flagged 8 files
  for `grievance_documents` that in fact only imported the unrelated
  `grievanceEvents`/`grievanceCaseAccessAssignments` exports from the same
  module — a false positive this round fixed.
- **Groups by `(schema, table)` instead of bare table name**, so tables
  declared via `pgSchema("x").table(...)` (e.g. `user_management.users`) are
  never confused with a same-named table in the default `public` schema.
- **Surfaces migration evidence**: for every conflicting table it now lists
  which `db/migrations/*.sql` files contain a matching `CREATE TABLE` /
  `ALTER TABLE`, so that evidence doesn't have to be rediscovered separately.

Re-running the corrected scanner against the as-of-round-1 codebase found
the count of genuinely conflicting tables was actually 23 (one higher, not
lower) — a `newsletter_list_subscribers` and a `user_management.user_sessions`
conflict that the column-name-only check had missed. This is exactly the
"no false claims of compatibility" outcome the correction was for.

## Resolved this round

### `grievance_documents` — fully remediated (not merely documented)

Live staging DB (`nzila-staging-db`, `information_schema.columns`,
read-only) confirmed `db/schema/domains/claims/workflows.ts`'s 31-column
declaration is canonical. The conflicting 6-column declaration in
`db/schema/domains/claims/grievance-lifecycle.ts` (no `organization_id`,
wrong FK column) has been **removed**, and its two real production
consumers fixed:

- `app/api/grievances/[id]/documents/route.ts` inserted into it using
  columns (`grievance_id`, `file_url`) that do not physically exist on the
  live table — this insert **always threw**, and because it ran before the
  real governed-document insert in the same `withRLSContext` block, this
  meant document upload was completely broken end-to-end. The route's
  outer `try/catch` masked this as a generic 500. The dead insert was
  removed; the real insert (into `documents`/`documentVersions`/
  `documentLinks`) now succeeds.
- `app/api/grievances/[id]/route.ts` had the identical defect on a SELECT
  (`eq(grievanceDocuments.grievanceId, ...)` against a column that doesn't
  exist) — also always threw, also masked by an outer 500 handler. Replaced
  with the already-working governed-documents query
  (`documents`/`documentLinks`), which the route already computed anyway.

Both fixes are net bug fixes, not behavior regressions — the broken code
paths never successfully executed against this live schema. `grievance_documents`
no longer appears in the `CONFLICTING_SCHEMA` section of
`apps/union-eyes/schema-duplicate-table-report.txt`. Regression test:
`apps/union-eyes/scripts/__tests__/grievance-documents-canonicalization.test.ts`.

### `grievances` (Tier 0 — inside 0108's protected set)

Canonical: `db/schema/domains/claims/grievances.ts` (42 columns,
live-DB-verified). Stale: `db/schema/grievance-schema.ts` (53 columns). The
4 real consumers (`lib/deadline-engine/recipient-resolver.ts`,
`lib/ingestion/fuzzy-dedup.ts`, `lib/integrations/timeline-integration.ts`,
`app/api/staging-proof/deadline-engine/scenario/route.ts`) only ever
touched fields present in BOTH declarations (`id`, `organizationId`,
`grievantId`, `grievantEmail`, `grievantName`, `unionRepId`, `title`,
`description`, `status`), so redirecting their imports to the canonical
module was a safe, mechanical fix (confirmed by typecheck + full test run).
`grievance-schema.ts`'s own `grievances` declaration was then converted to
a re-export of the canonical one (its other tables —
`grievanceResponses`/`arbitrations`/`settlements`/`grievanceTimeline`/
`grievanceDeadlines` — were left untouched; out of this round's scope).
`grievances` no longer appears in the conflict report at all (there is now
only one real `pgTable()` declaration).

### `member_documents` (Tier 0 — inside 0108's protected set)

Live staging DB showed 27 real columns. Neither existing declaration
matched fully: `member-documents-schema.ts` (10 columns) was **fully
accurate** for the columns it covered but incomplete; `member-profile-v2-schema.ts`
(24 columns) covered more ground but had 3 genuine errors (`user_id` typed
`uuid` when the live column is `text`; `organization_id` typed `notNull()`
when the live column is nullable; `file_size` typed nullable when the live
column is `NOT NULL`) and was missing 3 real columns (`file_type`,
`category`, `uploaded_at`). Neither declaration has any real (non-test)
production consumer today. The `member-profile-v2-schema.ts` declaration
was corrected to match all 27 live columns exactly; `member-documents-schema.ts`
was converted to a re-export shim (matching the existing `claims-schema.ts`
deprecation-shim pattern already used elsewhere in this codebase).
`member_documents` no longer appears in the conflict report.

## Remaining backlog (21 tables, fingerprint-ratcheted)

`ml_predictions`, `insight_recommendations`, `automation_rules`,
`reward_wallet_ledger`, `clc_sync_log`, `clc_webhook_log`,
`chart_of_accounts`, `communication_preferences`, `consent_records`,
`grievance_transitions`, `campaigns`, `message_log`,
`newsletter_list_subscribers`, `steward_assignments`, `employers`,
`gl_account_mappings`, `dues_transactions`, `payments`, `payment_methods`,
`webhook_deliveries`, `user_management.user_sessions`.

These are **not yet individually verified/fixed**. Several have real
direct-import bypasses (see `apps/union-eyes/schema-duplicate-table-report.txt`
for the current, regenerable list per table). None of these 21 are
currently known to intersect the RLS-protected/tenant-HTTP-reachable
surface the way `grievances`/`member_documents` did — that has not been
proven for all 21, only not yet disproven; each still needs the same
live-schema-first verification before being ruled in or out of #752's
scope.

## Ratchet: fingerprint set, not a raw count

`apps/union-eyes/scripts/__tests__/schema-duplicate-table-ratchet.test.ts`
now asserts the **current set** of `CONFLICTING_SCHEMA` table keys is a
subset of an explicitly recorded baseline set (21 keys, listed above,
keyed as `${schema}.${table}`) — not merely that the total count doesn't
exceed a number. A raw count can't distinguish "fixed table A, introduced
table B" from "no change" if the totals happen to match; the fingerprint
set can. The baseline shrinks as each table is resolved; it must never gain
an entry to accommodate a newly-introduced conflict.

## Why this is a real risk, and why it is NOT an RLS bypass

PostgreSQL Row-Level Security policies apply to the real table, independent
of which TypeScript declaration a given caller happens to import. A
conflicting schema declaration does **not**, by itself, let a caller read
another tenant's rows. The real risk is **data-correctness / type-safety**
— as the `grievance_documents` finding above shows, it can also hide
completely broken write/read paths behind a schema-shaped correctness bug
that a shallow "endpoint returns 500 sometimes" report would not obviously
connect to a schema conflict.

## Disposition

- **Not a merge blocker for #752's core RLS scope by itself** — the
  remaining 21 tables are tracked, ratcheted by fingerprint (not raw
  count), and none are yet proven to intersect the tenant-RLS-required
  surface. Each will go through the same live-schema-first process used
  for `grievances`/`member_documents` before #752 is considered complete.
- **Recommended follow-up invariant** (not yet fully achieved): "one
  canonical physical table → one canonical Drizzle declaration; other
  modules import the canonical declaration rather than redefine it." The
  final acceptance bar is zero unresolved conflicting declarations reachable
  by supported production runtime — at minimum, no unresolved conflict for
  any table in the runtime-authority manifest with runtime privilege, any
  table protected/proposed-for-protection by RLS, or any table reachable by
  tenant HTTP, platform-admin HTTP, a system job/worker/webhook, or a
  recording-relevant supported surface.


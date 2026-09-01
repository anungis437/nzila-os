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

## Remaining backlog (18 tables, fingerprint-ratcheted)

`ml_predictions`, `insight_recommendations`, `automation_rules`,
`reward_wallet_ledger`, `clc_sync_log`, `clc_webhook_log`,
`chart_of_accounts`, `communication_preferences`, `consent_records`,
`campaigns`, `message_log`, `newsletter_list_subscribers`,
`steward_assignments`, `gl_account_mappings`, `dues_transactions`,
`payments`, `payment_methods`, `webhook_deliveries`.

## Round 3 (2026-09-01): Phase-3A-relevant conflicts

Per follow-up review, resolved the tables that plausibly intersect the
grievance-continuity/auth-offboarding/security-critical surface before
returning to the broader backlog.

### `grievance_transitions` — fully resolved

Canonical: `db/schema/domains/claims/workflows.ts` (18 columns,
live-verified exact match). The other declaration
(`db/schema/grievance-workflow-schema.ts`, 19 cols) had a phantom `version`
column that does not physically exist. Its one real consumer
(`lib/workers/report-worker.ts`, filtered only by `organizationId`) was
redirected; the stale declaration converted to a re-export. No longer
appears in the conflict report.

### `steward_assignments` — three genuinely different concepts, one table name

Live DB has 33 columns (`organization_id`, `steward_id` as TEXT,
`steward_type`, `status`, `grievance_id`, etc.), matching
`db/schema/union-structure-schema.ts` by name (nullability was separately
relaxed by a historical fixup migration, same pattern as other tables in
this doc). Two OTHER declarations exist for the same table name but
represent genuinely different, never-reconciled data models:

- `db/schema/domains/communications/organizer-workflows.ts` (16 cols):
  a "steward assigned to a member" model (`steward_id` + `member_id` +
  `assignment_type` + `effective_date`) for an "Organizer Workflows"
  feature — **zero real consumers found anywhere in the repo**, and its
  columns don't exist on the live table at all. Left untouched (dead,
  no live risk) rather than guessing which of two unbuilt models to keep.
- `db/schema/domains/member/stewards.ts` (6 cols): a "grievance-case
  steward assignment" model (`grievanceId` + `stewardId` as **uuid**,
  referencing a separate `stewards` table) — missing `organization_id`
  entirely. Its real consumer, `lib/services/steward-assignment.ts`'s
  `assignSteward()`, inserted rows with **no organization_id at all**
  (a genuine tenant-isolation gap for every row it created). Fixed:
  redirected to the canonical declaration, added an `organizationId`
  parameter (the one real caller, `PATCH /api/grievances/[id]/assign`,
  already had it in scope) and supplied required `stewardType`/`startDate`
  values. `lib/cognition/ue-adapter.ts`'s read-only usage was also
  redirected. The stale declaration converted to a re-export.

The `organizer-workflows.ts` declaration remains a disclosed,
unreconciled conflict (dead code, zero risk) — resolving it would require
guessing which of two unimplemented product concepts to keep, which this
round declined to do blind.

### `user_sessions` — schema-qualification bug + a broken cleanup worker

Both existing declarations declared this as `pgSchema('user_management').table('user_sessions', ...)`.
Migration `0019_lonely_stephen_strange.sql` **dropped that exact
schema-qualified table** (`DROP TABLE "user_management"."user_sessions" CASCADE`),
and migrations `0055`/`0058`/`0081` recreated it in the **public** schema —
`0058_world_class_rls_policies.sql` already enables RLS with four
per-user policies (`sessions_select_own`/`_insert_own`/`_update_own`/`_delete_own`).
This means `lib/workers/cleanup-worker.ts`'s scheduled session-cleanup
DELETE queries had been failing on every invocation (querying a table that
hadn't existed since migration 0019). Fixed: corrected
`db/schema/user-management-schema.ts` to a plain `pgTable('user_sessions', ...)`
matching live schema/nullability exactly (cleanup-worker.ts already
imported from this file, so it is fixed automatically); converted
`db/schema/domains/member/user-management.ts`'s copy (which also had a
phantom `session_token_hash` column) to a re-export. Separately flagged,
NOT investigated in this pass: several other tables in these same two
files (`users`, `oauth_providers`, `password_reset_tokens`,
`auth_audit_log`) are also declared `user_management`-schema-qualified,
but only `organization_users` actually exists under that schema live —
broader scope, deferred.

### `employers` — column-name mismatch, not just type/nullability

Live DB has 33 columns matching `db/schema/union-structure-schema.ts`
exactly by name. The other declaration
(`db/schema/domains/compliance/employer-compliance.ts`, 8 cols) used
**`org_id`** (not `organization_id`), **`industry`**/**`contactEmail`**/**`contactPhone`**
(none of which exist live at all — live has `industry_code`, `email`,
`phone`). All 5 real consumers (`app/api/compliance/alerts/route.ts`,
`app/api/compliance/reports/route.ts`, `app/api/pilot/demo-data/route.ts`,
`lib/ai/employer-risk.ts`, `lib/ai/executive-insights.ts`) were filtering
by the phantom `employers.orgId` — every one of these compliance/AI
routes was throwing "column org_id does not exist" on every call. Also
found: the top-level barrel (`db/schema/index.ts`) had an **explicit,
incorrect** override — `export { employers } from "./domains/compliance"`
— actively pointing `db.query.employers` (the Drizzle relational query
API) at the wrong, non-matching declaration. Fixed: corrected the barrel
override, redirected all 5 consumers (renaming `orgId`→`organizationId`,
`contactEmail`→`email`, fixed the pilot demo-data seed generator's
`employerType` enum value), converted the stale declaration to a
re-export. No longer appears in the conflict report.

### `webhook_deliveries` — disposed as LATENT_UNREACHABLE, not canonicalized

Live DB has 26 columns, no `organization_id` — tenancy (if any) flows
through `webhook_id` (NOT NULL) or the nullable `subscription_id`. Two
conflicting declarations exist
(`db/schema/domains/infrastructure/integrations.ts`, 10 cols, keyed by
`webhook_id`; `db/schema/integration-schema.ts`, 19 cols, keyed by
`subscription_id`) — **both are individually column-accurate against
live** (not stale/wrong, just different partial views), suggesting two
historically-separate integration-delivery flows share one physical
table. `git grep` found **zero real production consumers** of
`webhookDeliveries` from either declaration — the earlier bypass flag on
`app/api/extensions/[id]/route.ts` was a false positive from the pre-fix
scanner (that route only imports the unrelated `apiIntegrations` export).
Given zero reachability, not canonicalized — doing so would require
product-level judgment about which delivery flow, if either, is current.

### `campaigns` / `message_log` / `communication_preferences` — investigated, deliberately NOT mechanically fixed

`campaigns` and `message_log` are heavily reachable (40+ and several real
references respectively across the communications dashboard, API routes,
and webhooks) and live-verified against
`db/schema/domains/communications/campaigns.ts` — the vast majority of
consumers already use this canonical declaration correctly. One
consumer, `lib/workers/message-queue-processor.ts`, still imports the
stale `db/schema/phase-4-messaging-schema.ts` declarations, which have
`sentCount`/`failedCount`/`skippedCount`/`totalRecipients` columns on
`campaigns` and `channel`/`body`/`variables`/`scheduledAt`/`externalId`/`nextRetryAt`
columns on `message_log` that do **not physically exist** — every
campaign-stat-increment and message-queue operation in this worker
throws. This was investigated in depth but **deliberately not fixed
blind**: the canonical schema replaced per-campaign counters with a
`stats` jsonb column, and — more importantly — canonical `messageLog`
only stores a `bodySnippet` (explicitly "first 500 chars for reference"),
not a full sendable body; the canonical `campaigns` table stores the
template `body`/`variables` instead. Properly fixing this worker requires
redesigning how it resolves and renders message content at send time
(campaign template + variables → per-recipient content → snippet for
audit), which is real feature work, not a mechanical import redirect —
exactly the risk this round's own methodology (section on messaging
tables) warned against rushing for code that sends real email/SMS to
real members. Disclosed and deferred; see the `campaigns`/`message_log`
manifest entries for the full citation. `communication_preferences` (a
separate, still-conflicting table — not to be confused with
`phase-4-messaging-schema.ts`'s differently-named
`communication_preferences_phase4`, which the same worker also queries
and does not conflict) was classified `TENANT_RLS_REQUIRED` based on its
real consumers but not individually live-verified in this pass.

## Scanner improvement: canonical-source map (round 3)

`scripts/canonical-schema-map.ts` is a small, source-controlled
`Record<(schema.table), modulePath>` recording which module owns the
canonical declaration for every physical table resolved so far. The
scanner (`getDeclarationStatus`) and report now tag each declaration in a
conflict group as `CANONICAL_DECLARATION`, `STALE_DUPLICATE`, or
(if not yet in the map) unlabeled. A new test,
`scripts/__tests__/canonical-schema-map.test.ts`, fails if any real
(non-test) code directly imports a declaration the map marks
`STALE_DUPLICATE` — re-export shims are fine (they resolve to the same
canonical object); a fresh, independently-declared stale `pgTable()` call
is not.

## Ratchet: fingerprint set, not a raw count

`apps/union-eyes/scripts/__tests__/schema-duplicate-table-ratchet.test.ts`
now asserts the **current set** of `CONFLICTING_SCHEMA` table keys is a
subset of an explicitly recorded baseline set (16 keys after round 4,
listed above,
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

## Round 4 (2026-09-01): `campaigns` / `message_log` reachability re-investigation

Round 3 dispositioned `campaigns` and `message_log` as `TENANT_RLS_REQUIRED`
with a "disclosed and deferred" note: `lib/workers/message-queue-processor.ts`
imported the stale `db/schema/phase-4-messaging-schema.ts` declaration
(columns like `sentCount`/`failedCount`/`channel`/`body`/`variables`/
`scheduledAt` that do not physically exist), and was treated as "ONE real
consumer" requiring a genuine messaging redesign to fix. On review, that
framing conflated "imports the stale schema" with "is itself invoked by
anything" — it never checked whether `message-queue-processor.ts` had any
caller of its own.

**Re-investigation**: `git grep` across `app/`, `actions/`, `lib/`,
`services/` for the module path (`@/lib/workers/message-queue-processor`)
and every exported symbol name (`processMessageQueue`,
`processCampaignMessages`, `getQueueStatus`) found exactly one importer:
the worker's own test file. The send-side capability is officially
registered `NOT_IMPLEMENTED`: `app/api/cron/process-messages/route.ts`
throws `ApiError.notImplemented()` per Wave 0 finding F-01
(`docs/union-eyes/reality-remediation/04_FINDINGS_AND_DISPOSITIONS.md`)
and never calls this worker or `campaign-service.ts`'s equivalent methods
(which also, independently, have zero callers beyond their own test file).
No cron config, route, or scheduler registration references either module.

**Conclusion**: the worker was genuinely dead/unwired code, not a live
production defect. `campaigns`/`message_log` themselves are heavily
reachable (40+ real references) and every actual production consumer
(dashboard, CRUD routes, webhook delivery tracking, open/click pixel
tracking, unsubscribe flow) already used the canonical
`db/schema/domains/communications/campaigns.ts` declaration correctly.

**Action taken** (deletion, not canonicalization — there was no real
behavior to preserve):
- Deleted `apps/union-eyes/lib/workers/message-queue-processor.ts` and its
  test.
- Deleted `apps/union-eyes/db/schema/phase-4-messaging-schema.ts` (verified
  zero other importers of any of its 3 exports — `message_log`,
  `campaigns`, and `communicationPreferences` → physical table
  `communication_preferences_phase4`, which is Django-owned and unaffected
  by this deletion; see `communication_preferences_phase4` manifest entry).
- Updated the `campaigns`/`message_log` manifest entries to drop the
  "redesign required" framing and correct `supportingCapability` to the
  real production consumers.
- Removed `public.campaigns` and `public.message_log` from the ratchet
  baseline (18 → 16 conflicting keys).

**Not addressed in this round**: the `communication_preferences_phase4`
manifest entry's `supportingCapability` list still needs precise
per-import re-verification (it was a raw symbol-name grep that likely
picked up an unrelated, identically-named export from a different
physical table) — tracked as a follow-up alongside `communication_preferences`
canonicalization.

## Disposition

- **Not a merge blocker for #752's core RLS scope by itself** — the
  remaining 18 tables are tracked, ratcheted by fingerprint (not raw
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


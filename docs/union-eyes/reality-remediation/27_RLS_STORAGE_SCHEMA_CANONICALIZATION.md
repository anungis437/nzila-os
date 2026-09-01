# 27 — RLS Storage-Authority Manifest: Schema Canonicalization Findings

Status: OPEN. Companion to `26_UE_PHASE3A_RUNTIME_ACCEPTANCE.md` and PR #752
(`fix/ue-runtime-rls-foundation`). Not a merge blocker for #752's RLS scope by
itself, but a **real, disclosed, separate finding** that must not be silently
dropped.

## What was found

While classifying `grievance_documents` in
`apps/union-eyes/db/rls-storage-authority-manifest.ts`, three different
schema files were found declaring `pgTable("grievance_documents", ...)` for
the same physical Postgres table, with genuinely different column sets:

| File | Columns | Has `organization_id`? |
| --- | --- | --- |
| `db/schema/domains/claims/workflows.ts` | 31 | Yes (NOT NULL) — **matches live DB** |
| `db/schema/grievance-workflow-schema.ts` | 31 | Yes (NOT NULL) — same shape, orphaned file |
| `db/schema/domains/claims/grievance-lifecycle.ts` | 6 | No — does not match live DB at all |

Verified against the live staging database (`nzila-staging-db`,
`information_schema.columns`, read-only, 2026-09-01): the real table has 33
columns including `organization_id uuid NOT NULL` and `claim_id uuid NOT
NULL` — matching `workflows.ts` (the barrel's own deliberately-chosen
canonical definition; see `db/schema/domains/claims/index.ts`'s comments).

A repo-wide scan (`apps/union-eyes/scripts/schema-duplicate-table-scan.ts`)
found this is **not an isolated incident**: 22 physical tables have
genuinely conflicting `pgTable()` declarations across the schema (341 have
duplicate-but-identical declarations, which is lower-risk but still worth
consolidating). The repository's existing "Schema Drift Detection" CI job
was green throughout — it does not check for this class of collision.

## Why this is a real risk, and why it is NOT an RLS bypass

PostgreSQL Row-Level Security policies apply to the real table, independent
of which TypeScript declaration a given caller happens to import. A
conflicting schema declaration does **not**, by itself, let a caller read
another tenant's rows. The real risk is **data-correctness / type-safety**:
whichever declaration a file imports determines what TypeScript believes
that table's columns are, and multiple real (non-test) production files
import the non-canonical, stale declaration **directly**, bypassing the
domain barrel's deliberate resolution:

- `grievances` (42 vs. 53 declared columns; live DB matches the 42-column
  `domains/claims/grievances.ts`) — the STALE 53-column
  `db/schema/grievance-schema.ts` is imported directly by
  `lib/deadline-engine/recipient-resolver.ts` (used by the live,
  HTTP/cron-reachable deadline-reminder system),
  `lib/ingestion/fuzzy-dedup.ts`, `lib/integrations/timeline-integration.ts`,
  and `app/api/staging-proof/deadline-engine/scenario/route.ts`.
- `grievance_documents` — the stale, non-matching 6-column
  `grievance-lifecycle.ts` declaration is imported directly by at least 10
  real route/service files, including `app/api/grievances/[id]/route.ts`
  and `app/api/grievances/[id]/documents/route.ts`.
- See `apps/union-eyes/schema-duplicate-table-report.txt` (regenerate with
  `pnpm --filter @nzila/union-eyes exec tsx scripts/schema-duplicate-table-scan.ts`)
  for the full list of all 22 conflicting tables and every direct-import
  bypass found for each.

`grievances` is already inside `0108`'s protected set — its RLS policy is
correct regardless of this finding (RLS is a database-level control). This
finding is about the *application layer's* type/column expectations
diverging from reality in specific files, which is a correctness risk
(wrong assumed columns, potential silent bugs) independent of tenant
isolation.

## Disposition

- **Not fixed in this pass.** Reconciling all 22 conflicts — verifying each
  against the live schema, redirecting every bypassing import to the
  canonical declaration, then deleting/consolidating the stale files — is a
  bounded but nontrivial follow-up requiring per-table verification and
  regression testing beyond what a single review pass can responsibly
  cover blind.
- **Ratcheted, not silently ignored**: `apps/union-eyes/scripts/__tests__/schema-duplicate-table-ratchet.test.ts`
  fails if the count of conflicting physical tables (currently 22) goes up,
  so this cannot silently get worse while the backlog is worked down.
- **`grievance_documents`'s manifest entry** (classified `TENANT_RLS_REQUIRED`,
  based on the confirmed-live 31/33-column canonical shape) documents this
  finding inline; see that entry for the full citation.
- **Recommended follow-up invariant** (not yet implemented): "one canonical
  physical table → one canonical Drizzle declaration; other modules import
  the canonical declaration rather than redefine it" — enforced by
  strengthening `scripts/schema-duplicate-table-scan.ts`'s ratchet from
  "does not increase" to "trends toward zero" once the backlog work begins.

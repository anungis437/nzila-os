/**
 * scripts/canonical-schema-map.ts — explicit, source-controlled record of
 * which module owns the CANONICAL Drizzle declaration for a physical
 * (schema, table) that has more than one `pgTable()`/`.table()` declaration
 * in the repo (PR #752 review, round 3, section 7).
 *
 * Purpose: prevent a future caller from re-importing a stale-but-still-
 * present compatibility shim, and give scripts/schema-duplicate-table-scan.ts
 * a ground truth to classify declarations as CANONICAL_DECLARATION /
 * STALE_DUPLICATE / UNRESOLVED instead of only comparing shapes.
 *
 * Convention: keys are `${schema}.${tableName}` (schema is "public" unless
 * the table is declared via `pgSchema(...).table(...)`); values are the
 * canonical declaration's module path, relative to db/schema/, no
 * extension, POSIX separators — matching `Declaration.modulePath` from
 * schema-duplicate-table-scan.ts.
 *
 * Only add an entry once a table's canonical declaration has actually been
 * verified against the live database (see
 * docs/union-eyes/reality-remediation/27_RLS_STORAGE_SCHEMA_CANONICALIZATION.md
 * for the verification record of each entry below). Do not guess.
 */
export const CANONICAL_SCHEMA_DECLARATIONS: Record<string, string> = {
  'public.grievances': 'domains/claims/grievances',
  'public.grievance_documents': 'domains/claims/workflows',
  'public.grievance_transitions': 'domains/claims/workflows',
  'public.member_documents': 'member-profile-v2-schema',
  'public.steward_assignments': 'union-structure-schema',
  'public.user_sessions': 'user-management-schema',
  'public.employers': 'union-structure-schema',
}

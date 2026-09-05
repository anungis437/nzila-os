/**
 * db/rls-0108-migration-sql-scan.ts
 *
 * Best-effort static parser over 0108's raw migration SQL text — extracts
 * every table name passed to a `ue_create_*_rls_policy(...)` helper call or
 * covered by a direct `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
 * statement. Used ONLY as a drift/typo check against
 * db/rls-0108-protected-tables.ts's hand-curated
 * ALL_0108_PROTECTED_TABLES (the actual source of truth) — never as the
 * primary "is this table 0108-protected" answer.
 *
 * PR #752 round 6 correction: the original regex required the helper
 * call's first quoted argument to be IMMEDIATELY followed by a closing
 * paren (`ue_create_direct_org_rls_policy('grievances')`), which silently
 * missed every 2-arg/3-arg call actually present in 0108
 * (`ue_create_direct_org_rls_policy('organization_members', 'organization_id', TRUE)`)
 * — producing 7 false-positive "missing from migration SQL" entries
 * (organization_members, organizations, documents, messages,
 * message_participants, message_read_receipts, message_notifications).
 * Extracted into its own module (with its own dedicated test covering
 * 1-arg/2-arg/3-arg calls and ALTER TABLE) so this parser-defect class
 * cannot silently reappear.
 */

const HELPER_CALL_TABLE_ARG = /ue_create_[a-z_]+_rls_policy\(\s*'([a-z_]+)'/g
const ALTER_TABLE_ENABLE_RLS = /ALTER TABLE "?([a-z_]+)"? ENABLE ROW LEVEL SECURITY/g

export function scanMigrationSqlForProtectedTables(sql: string): Set<string> {
  const tables = new Set<string>()
  for (const m of sql.matchAll(HELPER_CALL_TABLE_ARG)) tables.add(m[1]!)
  for (const m of sql.matchAll(ALTER_TABLE_ENABLE_RLS)) tables.add(m[1]!)
  return tables
}

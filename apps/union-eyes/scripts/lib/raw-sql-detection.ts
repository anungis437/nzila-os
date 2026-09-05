/**
 * scripts/lib/raw-sql-detection.ts
 *
 * Shared raw-SQL reachability detector, extracted from
 * db/__tests__/rls-storage-authority-manifest-raw-sql-latent.test.ts (PR
 * #752 round 7) so both that test file and
 * scripts/generate-storage-authority-census.ts (round 38) use the exact
 * same detection logic — a table can have zero Drizzle-symbol callers but
 * still be reachable via raw SQL (db.execute(sql`...`), a quoted
 * schema/table string, a repository/query-helper abstraction, or a direct
 * postgres client call).
 */

/**
 * Detects raw-SQL references to a PHYSICAL table name (snake_case, as it
 * appears in the actual database) within a source file's contents —
 * distinct from a Drizzle EXPORT NAME (camelCase symbol) reachability
 * check. Intentionally conservative (a simple substring/word-boundary
 * check, not a SQL parser): false positives (flagging a file that merely
 * mentions the table name in a comment) are acceptable, since the whole
 * point is to route uncertain cases to NEEDS_REVIEW rather than silently
 * defaulting to LATENT_UNREACHABLE's zero-grant outcome. False negatives
 * are the actual risk this function exists to reduce, not eliminate — a
 * human reviewer still makes the final classification call.
 */
export function hasPossibleRawSqlReference(physicalTableName: string, sourceText: string): boolean {
  const patterns = [
    // db.execute(sql`... FROM table_name ...`) / sql`... table_name ...`
    new RegExp(`FROM\\s+"?${physicalTableName}"?\\b`, 'i'),
    new RegExp(`INTO\\s+"?${physicalTableName}"?\\b`, 'i'),
    new RegExp(`UPDATE\\s+"?${physicalTableName}"?\\b`, 'i'),
    new RegExp(`JOIN\\s+"?${physicalTableName}"?\\b`, 'i'),
    // A quoted physical table-name string passed to a repository/query
    // helper or a raw client (e.g. queryTable('some_table'), a migration
    // helper call, or a schema-introspection string).
    new RegExp(`['"\`]${physicalTableName}['"\`]`),
  ];
  return patterns.some((re) => re.test(sourceText));
}

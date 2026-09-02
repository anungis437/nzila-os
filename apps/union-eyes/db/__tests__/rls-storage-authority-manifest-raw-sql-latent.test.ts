/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 round 7: strengthens the evidence bar for LATENT_UNREACHABLE
 * before it drives a "requiredRuntimePrivileges = []" / final zero-grant
 * disposition. Round 6/7's reachability scans checked for a table's
 * Drizzle EXPORT NAME (a typed symbol) across app/, actions/, lib/,
 * services/ — but a table can have zero Drizzle-symbol callers and STILL
 * be reachable via raw SQL (db.execute(sql`SELECT ... FROM some_table`),
 * a quoted schema/table string, a repository/query-helper abstraction, or
 * a direct postgres client call) that a Drizzle-symbol-only scan would
 * never find. Once LATENT_UNREACHABLE means "the eventual grant generator
 * removes union_eyes_runtime/union_eyes_system access to this table
 * entirely", that gap becomes a real correctness risk, not just an audit
 * nicety.
 *
 * This file provides (a) a reusable raw-SQL detector any future manifest
 * generator/scanner should call before assigning LATENT_UNREACHABLE, and
 * (b) the exact regression fixture the review asked for: a table with NO
 * Drizzle-symbol references but a real raw-SQL SELECT must NOT be scored
 * as latent by that detector.
 */
import { describe, expect, it } from 'vitest';

/**
 * Detects raw-SQL references to a PHYSICAL table name (snake_case, as it
 * appears in the actual database) within a source file's contents —
 * distinct from a Drizzle EXPORT NAME (camelCase symbol) reachability
 * check, which db/rls-storage-authority-manifest.ts's existing
 * LATENT_UNREACHABLE entries rely on. Intentionally conservative (a
 * simple substring/word-boundary check, not a SQL parser): false
 * positives (flagging a file that merely mentions the table name in a
 * comment) are acceptable here, since the whole point is to route
 * uncertain cases to NEEDS_REVIEW rather than silently defaulting to
 * LATENT_UNREACHABLE's zero-grant outcome. False negatives are the actual
 * risk this function exists to reduce, not eliminate — a human reviewer
 * still makes the final classification call.
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

describe('hasPossibleRawSqlReference (LATENT_UNREACHABLE raw-SQL detection guard)', () => {
  it('REGRESSION FIXTURE: a file with NO Drizzle-symbol import but a real raw SQL SELECT is detected — such a table must NOT be scored LATENT_UNREACHABLE by a Drizzle-symbol-only scan', () => {
    const fileWithNoDrizzleImportButRawSql = `
      // no import of the Drizzle export for 'example_orphan_table' anywhere in this file
      export async function legacyReport(db: { execute: (q: unknown) => Promise<unknown> }) {
        return db.execute(sql\`SELECT id, name FROM example_orphan_table WHERE active = true\`);
      }
    `;
    expect(hasPossibleRawSqlReference('example_orphan_table', fileWithNoDrizzleImportButRawSql)).toBe(true);
  });

  it('a genuinely unreferenced table (no Drizzle symbol, no raw SQL, no quoted table-name string) is not flagged', () => {
    const unrelatedFile = `
      export function unrelatedHelper(x: number): number {
        return x * 2;
      }
    `;
    expect(hasPossibleRawSqlReference('example_orphan_table', unrelatedFile)).toBe(false);
  });

  it('detects an INSERT INTO / UPDATE / JOIN raw-SQL reference too, not just SELECT FROM', () => {
    expect(hasPossibleRawSqlReference('audit_ledger', 'db.execute(sql`INSERT INTO audit_ledger (id) VALUES ($1)`)')).toBe(true);
    expect(hasPossibleRawSqlReference('audit_ledger', 'db.execute(sql`UPDATE audit_ledger SET x = 1`)')).toBe(true);
    expect(hasPossibleRawSqlReference('audit_ledger', 'db.execute(sql`SELECT * FROM claims JOIN audit_ledger ON true`)')).toBe(true);
  });

  it('detects a quoted physical table-name string passed to a repository/helper abstraction', () => {
    expect(hasPossibleRawSqlReference('legacy_widgets', "queryTable('legacy_widgets')")).toBe(true);
  });
});

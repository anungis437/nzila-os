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
 * generator/scanner should call before assigning LATENT_UNREACHABLE
 * (extracted to scripts/lib/raw-sql-detection.ts in round 38 so
 * scripts/generate-storage-authority-census.ts shares the exact same
 * detection logic), and (b) the exact regression fixture the review
 * asked for: a table with NO Drizzle-symbol references but a real
 * raw-SQL SELECT must NOT be scored as latent by that detector.
 */
import { describe, expect, it } from 'vitest';
import { hasPossibleRawSqlReference } from '../../scripts/lib/raw-sql-detection';


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

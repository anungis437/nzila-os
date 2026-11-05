/**
 * Test-only: a PGlite database holding the real Drizzle table declarations (DDL generated from them), so route
 * handlers run their actual statements. Used to prove mutation isolation: a row of another organization is not
 * modified and the same-organization path still is.
 */
import { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { ddl } from '@/lib/documents/test-support/pglite-document-database';

export type TestTable = Parameters<typeof ddl>[0];

export interface TableDatabase {
  pg: PGlite;
  db: PgliteDatabase<Record<string, never>>;
}

const BUILTIN_ARRAY_ELEMENTS = new Set(['text', 'varchar', 'integer', 'int', 'uuid', 'numeric', 'boolean', 'jsonb', 'bigint', 'smallint', 'timestamp', 'date']);

/** Arrays of pg enums are declared with the enum's own type name; the database here has none, so they become text[]. */
function tableDdl(table: TestTable): string {
  return ddl(table).replace(/("[\w]+") ([a-z_]+)\[\]/g, (match, column: string, element: string) =>
    BUILTIN_ARRAY_ELEMENTS.has(element) ? match : `${column} text[]`);
}

export async function createTableDatabase(tables: TestTable[], extraSql: string[] = []): Promise<TableDatabase> {
  const pg = new PGlite();
  for (const table of tables) await pg.exec(tableDdl(table));
  for (const statement of extraSql) await pg.exec(statement);
  return { pg, db: drizzle(pg) };
}

/** A db handle resolved per call from a holder, for hoisted vi.mock factories. */
export function lateBoundDb(holder: { db: unknown }): unknown {
  return new Proxy({}, {
    get(_target, property) {
      const database = holder.db as Record<PropertyKey, unknown> | null;
      const value = database ? database[property] : undefined;
      return typeof value === 'function' ? value.bind(database) : value;
    },
  });
}

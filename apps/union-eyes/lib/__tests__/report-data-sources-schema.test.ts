import { describe, expect, it } from 'vitest';
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core';
import { getTableName, is } from 'drizzle-orm';
import { PgTable as PgTableClass } from 'drizzle-orm/pg-core';
import * as schema from '@/db/schema';
import { DATA_SOURCES } from '../report-executor';

// DEF-0B11-RPT-DATA-SOURCE-REGISTRY-ADVERTISES-SOURCES-AND-COLUMNS-THE-EXECUTE-ROUTE-REFUSES-OR-THE-TABLES-DO-NOT-HAVE: the registry is what the
// builder offers and what the executor allows, so every column it names must be a physical column of the table it names.
function physicalColumns(table: string): Set<string> | null {
  for (const value of Object.values(schema as Record<string, unknown>)) {
    if (is(value, PgTableClass) && getTableName(value) === table) {
      return new Set(getTableConfig(value as PgTable).columns.map((column) => column.name));
    }
  }
  return null;
}

describe('report data source registry', () => {
  it.each(DATA_SOURCES.map((source) => [source.id, source] as const))('%s names only physical columns of its table', (_id, source) => {
    const columns = physicalColumns(source.table);
    expect(columns, `table ${source.table} is defined in the schema`).not.toBeNull();
    const missing = source.fields.filter((field) => !columns!.has(field.column)).map((field) => field.column);
    expect(missing).toEqual([]);
  });

  it('every joinable table is itself a registered source', () => {
    const tables = new Set(DATA_SOURCES.map((source) => source.table));
    for (const source of DATA_SOURCES) {
      expect(source.joinable.filter((table) => !tables.has(table)), `${source.id} joinable`).toEqual([]);
    }
  });
});

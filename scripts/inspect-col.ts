import * as schema from '../apps/union-eyes/db/schema/index';
import { getTableColumns, getTableName, is } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';

for (const [name, value] of Object.entries(schema)) {
  if (!is(value, PgTable)) continue;
  const cols = getTableColumns(value as PgTable<unknown>);
  const firstCol = Object.values(cols)[0] as unknown;
  console.log('Table:', getTableName(value as PgTable<unknown>));
  console.log('Column name:', firstCol.name);
  console.log('columnType:', firstCol.columnType);
  console.log('dataType:', firstCol.dataType);
  console.log('notNull:', firstCol.notNull);
  console.log('hasDefault:', firstCol.hasDefault);
  console.log('getSQLType:', typeof firstCol.getSQLType);
  if (typeof firstCol.getSQLType === 'function') console.log('SQL type:', firstCol.getSQLType());
  // Check for primary key
  console.log('primaryKey:', firstCol.primary);
  console.log('isUnique:', firstCol.isUnique);
  console.log('defaultFn:', typeof firstCol.defaultFn);
  console.log('enumValues:', firstCol.enumValues);
  // Second column for variety
  const secondCol = Object.values(cols)[1] as unknown;
  if (secondCol) {
    console.log('\n--- Second column ---');
    console.log('Column name:', secondCol.name);
    console.log('columnType:', secondCol.columnType);
    console.log('getSQLType:', typeof secondCol.getSQLType);
    if (typeof secondCol.getSQLType === 'function') console.log('SQL type:', secondCol.getSQLType());
  }
  // Third column
  const thirdCol = Object.values(cols)[2] as unknown;
  if (thirdCol) {
    console.log('\n--- Third column ---');
    console.log('Column name:', thirdCol.name);
    console.log('columnType:', thirdCol.columnType);
    if (typeof thirdCol.getSQLType === 'function') console.log('SQL type:', thirdCol.getSQLType());
  }
  break;
}

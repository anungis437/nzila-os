import { getTableConfig, PgDialect, PgTable } from 'drizzle-orm/pg-core'
import { is, SQL } from 'drizzle-orm'
import * as auth from '../../../../packages/db/src/schema/auth'
import { platformIdentityBindings } from '../../../../packages/db/src/schema/platform-authorization'

/** Synthetic fixture DDL compiled from the canonical Drizzle declarations. */
export function compileSyntheticAuthFixtureSql(): string {
  const dialect = new PgDialect()
  const quote = (name: string) => `"${name.replaceAll('"', '""')}"`
  const tables = Object.entries({ ...auth, platformIdentityBindings })
    .filter(([, table]) => is(table, PgTable))
    .map(([, table]) => getTableConfig(table as PgTable))
  return ['CREATE SCHEMA user_management;', ...tables.flatMap(table => {
    const columns = table.columns.map(column => {
      const defaultSql = column.default === undefined ? '' : ` DEFAULT ${
        is(column.default, SQL) ? dialect.sqlToQuery(column.default).sql
          : typeof column.default === 'string' ? `'${column.default.replaceAll("'", "''")}'`
            : String(column.default)}`
      return `${quote(column.name)} ${column.getSQLType()}${column.notNull ? ' NOT NULL' : ''}${
        column.primary ? ' PRIMARY KEY' : column.isUnique ? ' UNIQUE' : ''}${defaultSql}`
    })
    const checks = table.checks.map(check =>
      `CONSTRAINT ${quote(check.name)} CHECK (${dialect.sqlToQuery(check.value).sql})`)
    const foreignKeys = table.foreignKeys.map(key => {
      const reference = key.reference()
      const target = getTableConfig(reference.foreignTable)
      return `CONSTRAINT ${quote(key.getName())} FOREIGN KEY (${reference.columns.map(column => quote(column.name)).join(',')})
        REFERENCES ${quote(target.schema ?? 'public')}.${quote(target.name)} (${reference.foreignColumns.map(column => quote(column.name)).join(',')})
        ON DELETE ${key.onDelete ?? 'no action'} ON UPDATE ${key.onUpdate ?? 'no action'}`
    })
    const indexes = table.indexes.map(index => {
      const config = index.config
      const indexColumns = config.columns.map(column => {
        if (is(column, SQL)) return dialect.sqlToQuery(column).sql
        if ('name' in column && typeof column.name === 'string') return quote(column.name)
        throw new Error(`Unsupported canonical auth index column: ${config.name}`)
      })
      return `CREATE ${config.unique ? 'UNIQUE ' : ''}INDEX ${quote(config.name!)}
        ON ${quote(table.schema ?? 'public')}.${quote(table.name)} (${indexColumns.join(',')});`
    })
    return [`CREATE TABLE ${quote(table.schema ?? 'public')}.${quote(table.name)} (${[...columns, ...checks, ...foreignKeys].join(',')});`, ...indexes]
  })].join('\n')
}

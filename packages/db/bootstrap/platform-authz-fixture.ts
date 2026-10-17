import { compileAuthBootstrapSql } from '../src/auth-storage-authority/bootstrap-sql'
import { AUTH_EXECUTION_ROLES } from '../src/auth-storage-authority/execution-boundary'
import { getTableConfig, PgDialect, PgTable } from 'drizzle-orm/pg-core'
import { is, SQL } from 'drizzle-orm'
import * as auth from '../src/schema/auth'

/** Synthetic fixture DDL compiled from the canonical Drizzle declarations. */
export function compileSyntheticAuthFixtureSql(): string {
  const dialect = new PgDialect()
  const quote = (name: string) => `"${name.replaceAll('"', '""')}"`
  const tables = Object.entries(auth)
    .filter(([, table]) => is(table, PgTable))
    .map(([, table]) => getTableConfig(table as PgTable))
  return [
    'CREATE SCHEMA user_management;',
    ...tables.flatMap((table) => {
      const columns = table.columns.map((column) => {
        const defaultSql =
          column.default === undefined
            ? ''
            : ` DEFAULT ${
                is(column.default, SQL)
                  ? dialect.sqlToQuery(column.default).sql
                  : typeof column.default === 'string'
                    ? `'${column.default.replaceAll("'", "''")}'`
                    : String(column.default)
              }`
        return `${quote(column.name)} ${column.getSQLType()}${column.notNull ? ' NOT NULL' : ''}${
          column.primary ? ' PRIMARY KEY' : column.isUnique ? ' UNIQUE' : ''
        }${defaultSql}`
      })
      const checks = table.checks.map(
        (check) => `CONSTRAINT ${quote(check.name)} CHECK (${dialect.sqlToQuery(check.value).sql})`,
      )
      const foreignKeys = table.foreignKeys.map((key) => {
        const reference = key.reference()
        const target = getTableConfig(reference.foreignTable)
        return `CONSTRAINT ${quote(key.getName())} FOREIGN KEY (${reference.columns.map((column) => quote(column.name)).join(',')})
        REFERENCES ${quote(target.schema ?? 'public')}.${quote(target.name)} (${reference.foreignColumns.map((column) => quote(column.name)).join(',')})
        ON DELETE ${key.onDelete ?? 'no action'} ON UPDATE ${key.onUpdate ?? 'no action'}`
      })
      const indexes = table.indexes.map((index) => {
        const config = index.config
        const indexColumns = config.columns.map((column) => {
          if (is(column, SQL)) return dialect.sqlToQuery(column).sql
          if ('name' in column && typeof column.name === 'string') return quote(column.name)
          throw new Error(`Unsupported canonical auth index column: ${config.name}`)
        })
        return `CREATE ${config.unique ? 'UNIQUE ' : ''}INDEX ${quote(config.name!)}
        ON ${quote(table.schema ?? 'public')}.${quote(table.name)} (${indexColumns.join(',')});`
      })
      return [
        `CREATE TABLE ${quote(table.schema ?? 'public')}.${quote(table.name)} (${[...columns, ...checks, ...foreignKeys].join(',')});`,
        ...indexes,
      ]
    }),
  ].join('\n')
}

const mode = process.argv[2]
const databaseGuard = `DO $guard$ BEGIN
  IF current_database() NOT IN ('nzila_platform_authz_acceptance', 'cora_farmer360_acceptance') THEN
    RAISE EXCEPTION 'Dedicated disposable authorization database required';
  END IF;
END $guard$;`
let output: string
if (mode === 'schema') {
  output = compileSyntheticAuthFixtureSql()
} else if (mode === 'boundary') {
  output = `CREATE ROLE cora_acceptance_runtime NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS;
    CREATE ROLE cora_acceptance_system NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS;
    ${compileAuthBootstrapSql({ ordinaryRole: 'cora_acceptance_runtime', legacySystemRole: 'cora_acceptance_system' })}`
} else if (mode === 'login') {
  const password = process.env.CORA_AUTHZ_FIXTURE_PASSWORD
  if (!password || !/^[a-f0-9]{64}$/.test(password))
    throw new Error('Random fixture password required')
  output = `DO $login$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='cora_authz_fixture_gateway') THEN
      CREATE ROLE cora_authz_fixture_gateway LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    END IF;
  END $login$;
  ALTER ROLE cora_authz_fixture_gateway PASSWORD '${password}';
  GRANT "${AUTH_EXECUTION_ROLES.gateway}" TO cora_authz_fixture_gateway;`
} else {
  throw new Error('Expected schema, boundary or login fixture mode')
}
process.stdout.write(`${databaseGuard}\n${output}\n`)

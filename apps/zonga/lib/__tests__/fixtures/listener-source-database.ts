/** Selected current source declarations plus the existing immutable primary
 * audit trigger. SQL-engine component setup, never a bootstrap/native claim. */
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { drizzle } from 'drizzle-orm/pglite'
import { PgDialect, getTableConfig, type PgTable } from 'drizzle-orm/pg-core'
import { SQL, getTableName, is } from 'drizzle-orm'
import {
  orgs,
  orgMembers,
  auditLog,
  auditEvents,
  zongaCreators,
  zongaContentAssets,
  zongaReleases,
  zongaReleaseTracks,
  zongaListeners,
  zongaListenerFollows,
  zongaListenerFavorites,
  zongaListenerPlaylistSaves,
  zongaListenerActivity,
  zongaEvents,
  zongaPlaylists,
  zongaPlaylistItems,
  zongaModerationCases,
  zongaNotifications,
} from '@nzila/db/schema'

const quote = (value: string) => `"${value.replaceAll('"', '""')}"`
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`
async function install(db: PGlite, table: PgTable, installedEnums: Set<string>) {
  const source = getTableConfig(table),
    dialect = new PgDialect()
  for (const column of source.columns)
    if (column.enumValues?.length && !installedEnums.has(column.getSQLType())) {
      installedEnums.add(column.getSQLType())
      await db.exec(
        `CREATE TYPE ${quote(column.getSQLType())} AS ENUM (${column.enumValues.map(literal).join(',')})`,
      )
    }
  const columns = source.columns.map((column) => {
    let definition = `${quote(column.name)} ${column.getSQLType()}${column.notNull ? ' NOT NULL' : ''}${column.primary ? ' PRIMARY KEY' : ''}${column.isUnique ? ' UNIQUE' : ''}`
    if (column.default !== undefined) {
      const value = column.default
      const defaultSql = is(value, SQL)
        ? dialect.sqlToQuery(value).sql
        : typeof value === 'string'
          ? literal(value)
          : typeof value === 'object'
            ? `${literal(JSON.stringify(value))}::jsonb`
            : String(value)
      definition += ` DEFAULT ${defaultSql}`
    }
    return definition
  })
  for (const foreign of source.foreignKeys) {
    const target = foreign.reference()
    columns.push(
      `FOREIGN KEY (${target.columns.map((c) => quote(c.name)).join(',')}) REFERENCES ${quote(getTableName(target.foreignTable))}(${target.foreignColumns.map((c) => quote(c.name)).join(',')})`,
    )
  }
  for (const check of source.checks) {
    const constraint = dialect.sqlToQuery(check.value)
    if (constraint.params.length)
      throw new Error('Bound source CHECK requires explicit fixture handling')
    columns.push(`CONSTRAINT ${quote(check.name)} CHECK (${constraint.sql})`)
  }
  await db.exec(`CREATE TABLE ${quote(source.name)}(${columns.join(',')})`)
}

export async function createZongaSourceDatabase() {
  const db = new PGlite(),
    enums = new Set<string>(),
    statements: string[] = []
  for (const table of [
    orgs,
    orgMembers,
    auditLog,
    auditEvents,
    zongaCreators,
    zongaContentAssets,
    zongaReleases,
    zongaReleaseTracks,
    zongaListeners,
    zongaPlaylists,
    zongaListenerFollows,
    zongaListenerFavorites,
    zongaListenerPlaylistSaves,
    zongaListenerActivity,
    zongaEvents,
    zongaPlaylistItems,
    zongaModerationCases,
    zongaNotifications,
  ])
    await install(db, table, enums)
  await db.exec(
    readFileSync(
      new URL(
        '../../../../../packages/db/drizzle/0004_audit_events_immutable.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  for (const [file, names] of [
    ['0001_zonga_platform_upgrade.sql', ['zonga_track_assets', 'zonga_processed_variants']],
    ['0002_zonga_streaming_infrastructure.sql', ['zonga_media_variants']],
  ] as const) {
    const text = readFileSync(new URL(`../../../db/migrations/${file}`, import.meta.url), 'utf8')
    for (const name of names) {
      const statement = text.match(
        new RegExp(`CREATE TABLE IF NOT EXISTS ${name}\\s*\\([\\s\\S]*?\\n\\);`),
      )?.[0]
      if (!statement) throw new Error('Actual released media declaration missing: ' + name)
      await db.exec(statement)
    }
  }
  await db.exec(`CREATE ROLE zonga_action_fixture NOLOGIN NOSUPERUSER NOBYPASSRLS;
    GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO zonga_action_fixture;
    REVOKE UPDATE,DELETE ON public.audit_events FROM zonga_action_fixture;
    GRANT SELECT,INSERT ON public.audit_events TO zonga_action_fixture;
    SET ROLE zonga_action_fixture`)
  const database = drizzle(db, {
    logger: {
      logQuery(query) {
        statements.push(query)
      },
    },
  })
  const operator = async (sql: string, params: unknown[] = []) => {
    await db.exec('RESET ROLE')
    try {
      return await db.query(sql, params)
    } finally {
      await db.exec('SET ROLE zonga_action_fixture')
    }
  }
  return { db, database, operator, statements, close: () => db.close() }
}

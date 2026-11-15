import { PGlite } from '@electric-sql/pglite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AUTH_EXECUTION_ROLES } from '@nzila/db/auth-storage-authority'
import { admissionQueries, type CatalogRow } from './catalog-admission-core.mjs'
import { canonicalAdmissionQueries } from './canonical-catalog-admission'
import { catalogSnapshotExecutor, compileCatalogSnapshot } from './catalog-admission-batch'
import { evaluateCatalogAdmission } from './catalog-admission'

let database: PGlite | undefined
afterEach(async () => { vi.unstubAllEnvs(); await database?.close(); database = undefined })

describe('catalog snapshot PostgreSQL semantics', () => {
  it('preserves actual catalog scalar types, nulls, record keys and ordered text arrays', async () => {
    database = new PGlite()
    const statements = [
      `SELECT oid::text AS oid, relname::name AS name, relkind, relrowsecurity AS enabled,
        ARRAY['search_path=pg_catalog','b','a']::text[] AS settings, NULL::text AS absent,
        19::smallint AS trigger_type FROM pg_class ORDER BY oid DESC LIMIT 3`,
      `SELECT value FROM (VALUES ('second'),('first')) AS wanted(value) ORDER BY value DESC`,
      `SELECT oid::text AS oid FROM pg_class WHERE false`,
    ]
    const serial = await Promise.all(statements.map(statement => database!.query<CatalogRow>(statement).then(result => result.rows)))
    const batched = (await database.query<CatalogRow>(compileCatalogSnapshot(statements))).rows
    const replay = catalogSnapshotExecutor(statements, batched)
    for (let index = 0; index < statements.length; index++) {
      const actual = await replay(statements[index])
      expect(actual).toEqual(serial[index])
      if (actual.length) expect(Object.keys(actual[0])).toEqual(Object.keys(serial[index][0]))
    }
  }, 20_000)

  it('executes the legacy plan without requiring the absent canonical schema', async () => {
    database = new PGlite()
    await database.exec('CREATE ROLE union_eyes_runtime NOLOGIN; CREATE ROLE union_eyes_system NOLOGIN')
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '0')
    const statements = admissionQueries.map(query => query.sql)
    expect(statements).toHaveLength(12)
    const serial = await evaluateCatalogAdmission(async statement => (await database!.query<CatalogRow>(statement)).rows)
    const envelope = (await database.query<CatalogRow>(compileCatalogSnapshot(statements))).rows
    expect(await evaluateCatalogAdmission(catalogSnapshotExecutor(statements, envelope))).toEqual(serial)
    expect((await database.query("SELECT oid FROM pg_namespace WHERE nspname='user_management'")).rows).toEqual([])
  }, 20_000)

  it('executes all 28 exact catalog reads in one statement and matches independent serial assessment', async () => {
    database = new PGlite()
    // Disposable local PostgreSQL catalog only; no Azure/live database or auth mock.
    for (const role of [...Object.values(AUTH_EXECUTION_ROLES), 'union_eyes_runtime', 'union_eyes_system']) {
      await database.exec(`CREATE ROLE "${role}" NOLOGIN`)
    }
    await database.exec('CREATE SCHEMA user_management')
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '1')
    vi.stubEnv('UE_ENVIRONMENT', 'local-catalog-transport-equivalence')
    const statements = [...admissionQueries.map(query => query.sql), ...canonicalAdmissionQueries]
    expect(statements).toHaveLength(28)
    const serialRows = new Map<string, CatalogRow[]>(), serialCalls: string[] = []
    const serialReport = await evaluateCatalogAdmission(async statement => {
      serialCalls.push(statement)
      const rows = (await database!.query<CatalogRow>(statement)).rows
      serialRows.set(statement, rows)
      return rows
    })
    expect(serialCalls).toEqual(statements)
    const envelope = (await database.query<CatalogRow>(compileCatalogSnapshot(statements))).rows
    const replay = catalogSnapshotExecutor(statements, envelope)
    for (const statement of statements) expect(await replay(statement)).toEqual(serialRows.get(statement))
    const batchedReport = await evaluateCatalogAdmission(replay)
    expect(batchedReport).toEqual(serialReport)
    // This intentionally incomplete local schema must remain inadmissible.
    expect(serialReport.ok).toBe(false)
    expect(batchedReport.violations).not.toHaveLength(0)
  }, 20_000)
})

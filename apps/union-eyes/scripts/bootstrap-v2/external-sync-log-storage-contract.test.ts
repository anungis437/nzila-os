/** Actual source-compiled ACLs in a disposable SQL engine, not native TCP/login or a Next page proof. */
import { PGlite } from '@electric-sql/pglite'
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import committedPlan from '../../../../docs/union-eyes/bootstrap-v2/UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json'
import { externalDataSyncLog } from '../../db/schema/domains/data/benchmarks'
import {
  storageAuthorityManifest,
  type StorageAuthorityEntry,
} from '../../db/rls-storage-authority'
import { compileSecurity } from './security'
import { reconcileCurrentDeclarationAuthority } from './current-authority'
import {
  EXTERNAL_SYNC_LOG_DECLARATION_SOURCE,
  EXTERNAL_SYNC_LOG_MODEL_SOURCE,
  EXTERNAL_SYNC_LOG_SYSTEM_READ_COLUMNS,
  currentExternalSyncLogAuthority,
} from './external-sync-log-storage-contract'
import type { V2Plan } from './source'
const current = committedPlan as unknown as V2Plan
const inherited = storageAuthorityManifest.find(
  (entry) => entry.table === 'external_data_sync_log',
)!
function fixturePlan() {
  const source = structuredClone(
    current.tables.find((table) => table.name === 'external_data_sync_log')!,
  )
  source.authority = currentExternalSyncLogAuthority(source, inherited)!
  return {
    ...current,
    tables: [source],
    securityBlockers: [],
    authExecution: undefined,
    frameworkExecution: undefined,
  }
}
let db: PGlite
const projection = EXTERNAL_SYNC_LOG_SYSTEM_READ_COLUMNS.map((name) => `"${name}"`).join(',')
const baselineId = 'ue-sync-baseline'
async function asRole<T>(who: 'system' | 'runtime', operation: () => Promise<T>, commit = false) {
  await db.exec(
    `SET SESSION AUTHORIZATION ue_sync_${who}_login;BEGIN;SET LOCAL ROLE union_eyes_${who}`,
  )
  try {
    const value = await operation()
    await db.exec(commit ? 'COMMIT' : 'ROLLBACK')
    return value
  } catch (error) {
    await db.exec('ROLLBACK')
    throw error
  } finally {
    await db.exec('RESET ROLE;SET SESSION AUTHORIZATION postgres;RESET ROLE')
  }
}
const history = async () =>
  (
    await db.query(
      'SELECT to_jsonb(t)::text AS row FROM public.external_data_sync_log t ORDER BY sync_id',
    )
  ).rows
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`CREATE ROLE union_eyes_runtime NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    CREATE ROLE union_eyes_system NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    CREATE ROLE ue_v2_owner NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    CREATE ROLE ue_sync_runtime_login LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    CREATE ROLE ue_sync_system_login LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    GRANT union_eyes_runtime TO ue_sync_runtime_login;
    GRANT union_eyes_system TO ue_sync_system_login;`)
  const ddl = await generateMigration(
    generateDrizzleJson({}),
    generateDrizzleJson({ externalDataSyncLog }),
  )
  for (const statement of ddl) await db.exec(statement)
  // Current Django BaseModel and a retained extra field never widen Drizzle read authority.
  await db.exec(
    'ALTER TABLE public.external_data_sync_log ADD COLUMN created_at timestamptz DEFAULT now(),ADD COLUMN updated_at timestamptz DEFAULT now(),ADD COLUMN retained_diagnostic text',
  )
  // An existing explicit column grant must not survive the table-level reset.
  await db.exec('GRANT SELECT(error_details) ON public.external_data_sync_log TO union_eyes_system')
  for (const statement of compileSecurity(fixturePlan()).statements) await db.exec(statement)
  await db.query(
    `INSERT INTO public.external_data_sync_log(sync_id,source,source_type,status,sync_type,error_details,initiated_by,parameters,retained_diagnostic)
    VALUES($1,'synthetic','synthetic','completed','scheduled','synthetic private diagnostics','synthetic initiator','synthetic private parameters','synthetic retained data')`,
    [baselineId],
  )
}, 30000)
afterAll(async () => {
  await db?.close()
})
describe('source-bound operational sync projection', () => {
  it('derives exactly13 fields from the actual16-column declaration, preserving the historical registry', () => {
    const before = structuredClone(inherited)
    const names = getTableConfig(externalDataSyncLog).columns.map((column) => column.name)
    expect(names).toHaveLength(16)
    expect([...EXTERNAL_SYNC_LOG_SYSTEM_READ_COLUMNS].sort()).toEqual(
      names
        .filter((name) => !['error_details', 'initiated_by', 'parameters'].includes(name))
        .sort(),
    )
    for (const source of [EXTERNAL_SYNC_LOG_MODEL_SOURCE, EXTERNAL_SYNC_LOG_DECLARATION_SOURCE]) {
      const authority = reconcileCurrentDeclarationAuthority(
        { name: 'external_data_sync_log', source },
        inherited,
      )
      expect(authority).toMatchObject({
        classification: inherited.classification,
        requiredRuntimePrivileges: ['INSERT', 'UPDATE'],
        requiredSystemPrivileges: ['INSERT', 'UPDATE'],
        invocationAuthority: inherited.invocationAuthority,
        dbExecutionPrincipal: inherited.dbExecutionPrincipal,
      })
    }
    expect(inherited).toEqual(before)
    expect(inherited.requiredSystemPrivileges).toEqual(['SELECT', 'INSERT', 'UPDATE'])
  })
  it('refuses an undeclared source owner', () => {
    expect(() =>
      currentExternalSyncLogAuthority(
        { name: 'external_data_sync_log', source: 'unreviewed' },
        inherited,
      ),
    ).toThrow('UE_V2_SYNC_LOG_DECLARATION_SOURCE_REQUIRED')
  })
  it.each<{ name: string; change: Partial<StorageAuthorityEntry> }>([
    {
      name: 'ordinary SELECT',
      change: { requiredRuntimePrivileges: ['SELECT', 'INSERT', 'UPDATE'] },
    },
    {
      name: 'system DELETE',
      change: { requiredSystemPrivileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] },
    },
    { name: 'wrong caller class', change: { invocationAuthority: 'TENANT_USER' } },
    { name: 'missing callers', change: { supportingCapability: [] } },
  ])('refuses $name source drift instead of learning authority from a database', ({ change }) => {
    const bad = { ...inherited, ...change }
    expect(() =>
      currentExternalSyncLogAuthority(
        { name: 'external_data_sync_log', source: EXTERNAL_SYNC_LOG_MODEL_SOURCE },
        bad,
      ),
    ).toThrow('UE_V2_SYNC_LOG_SOURCE_WRITE_AUTHORITY_REQUIRED')
  })
  it('requires the compiler input to carry the reviewed write-only table contract', () => {
    const plan = fixturePlan()
    plan.tables[0].authority = inherited
    expect(() => compileSecurity(plan)).toThrow('UE_V2_SYNC_LOG_COLUMN_AUTHORITY_REQUIRED')
  })
  it('reads the exact dashboard projection through the actual non-owner system role', async () => {
    await asRole('system', async () => {
      expect((await db.query('SELECT current_user AS actor,session_user AS login')).rows).toEqual([
        { actor: 'union_eyes_system', login: 'ue_sync_system_login' },
      ])
      const result = await db.query<Record<string,unknown>>(
        `SELECT ${projection} FROM public.external_data_sync_log WHERE sync_id=$1`,
        [baselineId],
      )
      expect(result.rows).toHaveLength(1)
      expect(Object.keys(result.rows[0]).sort()).toEqual(
        [...EXTERNAL_SYNC_LOG_SYSTEM_READ_COLUMNS].sort(),
      )
      expect(result.rows[0]).toMatchObject({
        sync_id: baselineId,
        source: 'synthetic',
        status: 'completed',
      })
    })
  })
  it('retains real cron INSERT/UPDATE, safe RETURNING and committed readback without table SELECT', async () => {
    const id = `ue-sync-${randomUUID()}`
    await asRole(
      'system',
      async () => {
        await db.query(
          "INSERT INTO public.external_data_sync_log(sync_id,source,source_type,sync_type,status) VALUES($1,'synthetic','synthetic','scheduled','running')",
          [id],
        )
        expect(
          (
            await db.query(
              "UPDATE public.external_data_sync_log SET status='completed',records_processed=4,error_details='synthetic internal detail' WHERE sync_id=$1 RETURNING sync_id",
              [id],
            )
          ).rows,
        ).toEqual([{ sync_id: id }])
      },
      true,
    )
    expect(
      (
        await db.query(
          'SELECT status,records_processed,error_details FROM public.external_data_sync_log WHERE sync_id=$1',
          [id],
        )
      ).rows,
    ).toEqual([
      { status: 'completed', records_processed: 4, error_details: 'synthetic internal detail' },
    ])
  })
  it('has no broad system or ordinary read privilege, and grants only actual source columns', async () => {
    expect(
      (
        await db.query(
          "SELECT has_table_privilege('union_eyes_system','public.external_data_sync_log','SELECT') AS system,has_table_privilege('union_eyes_runtime','public.external_data_sync_log','SELECT') AS runtime",
        )
      ).rows,
    ).toEqual([{ system: false, runtime: false }])
    const granted = (
      await db.query<{
        name: string
      }>(`SELECT attname AS name FROM pg_attribute WHERE attrelid='public.external_data_sync_log'::regclass AND attnum<>0 AND NOT attisdropped
      AND has_column_privilege('union_eyes_system',attrelid,attnum,'SELECT') ORDER BY attname`)
    ).rows.map((row) => row.name)
    expect(granted).toEqual([...EXTERNAL_SYNC_LOG_SYSTEM_READ_COLUMNS].sort())
  })
  it.each([
    '*',
    'error_details',
    'initiated_by',
    'parameters',
    'created_at',
    'updated_at',
    'retained_diagnostic',
    'xmin',
    'ctid',
  ])('denies system %s reads without changing any stored field', async (column) => {
    const before = await history()
    await expect(
      asRole('system', () =>
        db.query(
          `SELECT ${column === '*' ? '*' : `"${column}"`} FROM public.external_data_sync_log WHERE sync_id=$1`,
          [baselineId],
        ),
      ),
    ).rejects.toMatchObject({ code: '42501' })
    expect(await history()).toEqual(before)
  })
  it('denies even safe columns to the ordinary runtime reader', async () => {
    const before = await history()
    await expect(
      asRole('runtime', () => db.query(`SELECT ${projection} FROM public.external_data_sync_log`)),
    ).rejects.toMatchObject({ code: '42501' })
    expect(await history()).toEqual(before)
  })
  it('denies system DELETE without changing retained history', async () => {
    const before = await history()
    await expect(
      asRole('system', () => db.query('DELETE FROM public.external_data_sync_log')),
    ).rejects.toMatchObject({ code: '42501' })
    expect(await history()).toEqual(before)
  })
  it('requires the existing platform page gates before reading the overview, and excludes dues count SQL', () => {
    const page = readFileSync(
      path.resolve(import.meta.dirname, '../../app/[locale]/dashboard/data-source/page.tsx'),
      'utf8',
    )
    const body = page.slice(page.indexOf('export default async function'))
    expect(body.indexOf("hasMinRole('integration_manager')")).toBeGreaterThan(0)
    expect(body.indexOf('await isSystemAdmin()')).toBeGreaterThan(
      body.indexOf("hasMinRole('integration_manager')"),
    )
    expect(body.indexOf('await loadDataSourceOverview()')).toBeGreaterThan(
      body.indexOf('await isSystemAdmin()'),
    )
    const reader = readFileSync(
      path.resolve(import.meta.dirname, '../../lib/dashboard-reads/data-source.ts'),
      'utf8',
    )
    expect(reader).toMatch(/sql\.join\(\s*SYNC_LOG_OVERVIEW_COLUMNS\.map/)
    expect(reader).not.toContain('FROM dues_assignments')
    expect(page).not.toContain('dues_assignments:')
    expect(page).toMatch(/getAllDataSources\(\)\.filter\(source => Object\.hasOwn\(internalCounts, source\.table\)\)/)
    expect(page).not.toContain('internalCounts[ds.table] ?? 0')
  })
})

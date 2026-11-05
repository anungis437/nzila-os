/**
 * Platform 0061 and cache 0052 on real PostgreSQL: the 23 relations their Drizzle declarations name and the storage-authority manifest classifies,
 * which neither Django nor an earlier migration created (UE-CONV-H-007).
 *
 * Proves, on the combined Django + Drizzle schema as the real roles:
 *   - every relation has exactly the declared columns, nullability, primary key, enum members, indexes and foreign keys, and exactly the access its
 *     manifest entry names (row security and policies, and the privileges of both roles in both directions);
 *   - the ten tenant tables isolate by organization for each command the runtime role holds, and refuse the commands it does not;
 *   - the two customer-success tables are readable by the system role only, and the CBA intelligence domain is the tenant-less shared reference data the
 *     manifest documents (rounds 43 and 51), with its keys and enums enforced;
 *   - the rollbacks remove exactly what the migrations created, re-applying restores it (row security and policies in place, grants left to the manifest
 *     activation), the forward migration refuses to run over an existing relation or a different enum, and the rollback refuses to drop a relation with rows.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database that has no other session open:
 * the round trip runs in a clone of it (CREATE DATABASE ... TEMPLATE), which PostgreSQL only allows for a database that is not in use.
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import { getTableConfig, PgEnumColumn, PgTable } from 'drizzle-orm/pg-core'
import { is } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as declarations from '../schema'
import { storageAuthorityManifest } from '../rls-storage-authority/index'
import { evaluateTable, observeTable, RUNTIME_ROLE, SYSTEM_ROLE, verifyEntries } from '../../scripts/rls-enforcement/post-apply-verifier-core'

const URL = process.env.UE_AUTHORITY_COMBINED_URL

const TENANT = [
  'anti_scab_violations', 'cnesst_filings', 'joint_hs_committees', 'pay_equity_exercises', 'preventive_withdrawals',
  'right_of_refusal_events', 'wcb_claims', 'wcb_employer_assessments', 'member_dues_issues', 'payroll_deductions',
]
const SYSTEM_ONLY = ['customer_nps_surveys', 'customer_onboarding_milestones']
// Parents first, so a row can name the parent it references.
const CBA = [
  'cba_intel_sources', 'cba_intel_ingestion_jobs', 'cba_intel_documents', 'cba_intel_extraction_runs', 'cba_intel_agreements', 'cba_intel_findings',
  'cba_intel_clauses', 'cba_intel_wage_adjustments', 'cba_intel_review_decisions', 'cba_intel_benchmark_snapshots', 'cba_intel_freshness_log',
]
const ALL = [...TENANT, ...SYSTEM_ONLY, ...CBA]
const PLATFORM = '0061_declared_absent_relations'
const CACHE = '0052_declared_absent_relations_rls_closure'

const read = (dir: string, file: string) => readFileSync(join(__dirname, '..', dir, file), 'utf8')
const statementsOf = (sql: string) => sql.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean)

const declared = new Map<string, PgTable>()
for (const value of Object.values(declarations as Record<string, unknown>)) {
  if (is(value, PgTable)) {
    const name = getTableConfig(value).name
    if (!declared.has(name)) declared.set(name, value)
  }
}
const manifest = new Map(storageAuthorityManifest.map((entry) => [entry.table, entry]))
const operationsOf = (value: readonly string[] | 'TBD' | undefined) => new Set(value === 'TBD' || value === undefined ? [] : value)

let sequence = 0
function sampleValue(column: { getSQLType(): string; enumValues?: readonly string[] | string[] }): unknown {
  if (column.enumValues?.length) return column.enumValues[0]
  const type = column.getSQLType().toLowerCase()
  if (type === 'uuid') return randomUUID()
  if (type.startsWith('varchar') || type === 'text') return `v${(sequence++).toString(36)}`
  if (type.startsWith('numeric')) return '0.5'
  if (['integer', 'smallint', 'bigint'].includes(type)) return 1
  if (type === 'boolean') return false
  if (type === 'date') return '2025-01-01'
  if (type.startsWith('timestamp')) return '2025-01-01T00:00:00Z'
  if (type === 'jsonb' || type === 'json') return '{}'
  throw new Error(`no sample value for ${type}`)
}

describe.skipIf(!URL)('the declared relations platform 0061 and cache 0052 create, as the real roles', () => {
  const ORG_A = randomUUID()
  const ORG_B = randomUUID()
  const scratchName = `ue_absent_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
  let admin: pg.Client
  let scratch: pg.Client
  let maintenance: pg.Client
  const parents = new Map<string, string>()

  const urlFor = (database: string) => {
    const url = new globalThis.URL(URL!)
    url.pathname = `/${database}`
    return url.toString()
  }

  async function inRole<T>(client: pg.Client, role: string, org: string | null, work: () => Promise<T>): Promise<T> {
    await client.query('BEGIN')
    try {
      await client.query(`SET LOCAL ROLE ${role}`)
      if (org) await client.query(`SELECT set_config('app.current_org_id', $1, true)`, [org])
      const result = await work()
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    }
  }

  /** A row with every column that has neither a default nor a null allowance, plus the overrides (organization, parents). */
  function rowFor(name: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
    const config = getTableConfig(declared.get(name)!)
    const row: Record<string, unknown> = {}
    for (const column of config.columns) if (column.notNull && !column.hasDefault) row[column.name] = sampleValue(column)
    for (const fk of config.foreignKeys) {
      const reference = fk.reference()
      const parent = getTableConfig(reference.foreignTable).name
      for (const local of reference.columns) if (parents.has(parent)) row[local.name] = parents.get(parent)
    }
    return { ...row, ...overrides }
  }

  async function insertRow(client: pg.Client, name: string, overrides: Record<string, unknown> = {}) {
    const row = rowFor(name, overrides)
    const columns = Object.keys(row)
    const { rows } = await client.query(
      `INSERT INTO public.${name} (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id::text AS id`,
      columns.map((c) => row[c]),
    )
    return rows[0].id as string
  }

  /**
   * The verifier's per-table oracle over all 23 entries. verifyEntries only reaches the row-security classes, so the ten shared CBA tables and the closed
   * freshness log are evaluated here directly: both are held to the privileges their manifest entry names, and nothing more.
   */
  async function oracleDiffs(client: pg.Client) {
    const diffs: Array<{ kind: string; text: string }> = []
    for (const name of ALL) {
      const observed = await observeTable(client, name)
      expect(observed, `${name} exists`).not.toBeNull()
      diffs.push(...evaluateTable(manifest.get(name)!, observed!))
    }
    return diffs
  }

  const idsIn = async (client: pg.Client, role: string, org: string | null, table: string) =>
    (await inRole(client, role, org, () => client.query(`SELECT id::text AS id FROM public.${table}`))).rows.map((r) => r.id as string).sort()

  beforeAll(async () => {
    const database = decodeURIComponent(new globalThis.URL(URL!).pathname.slice(1))
    maintenance = new pg.Client({ connectionString: urlFor('postgres') })
    await maintenance.connect()
    // The clone must be taken before this file opens its own session on the database it copies.
    await maintenance.query(`CREATE DATABASE ${scratchName} TEMPLATE ${database}`)
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    scratch = new pg.Client({ connectionString: urlFor(scratchName) })
    await scratch.connect()
    for (const org of [ORG_A, ORG_B]) {
      await admin.query(
        `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
         VALUES ($1,$2,$3,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`,
        [org, `absent-${org.slice(0, 8)}`, `absent-${org.slice(0, 8)}`],
      )
    }
  }, 240_000)

  afterAll(async () => {
    await admin?.end().catch(() => undefined)
    await scratch?.end().catch(() => undefined)
    await maintenance?.query(`DROP DATABASE IF EXISTS ${scratchName} WITH (FORCE)`).catch(() => undefined)
    await maintenance?.end().catch(() => undefined)
  })

  it('creates every declared relation with exactly the declared columns, keys, enums and indexes', async () => {
    expect(ALL).toHaveLength(23)
    for (const name of ALL) {
      const config = getTableConfig(declared.get(name)!)
      const columns = (await admin.query(`SELECT column_name, is_nullable, udt_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`, [name])).rows
      expect(columns.map((c) => c.column_name).sort(), name).toEqual(config.columns.map((c) => c.name).sort())
      for (const column of config.columns) {
        const physical = columns.find((c) => c.column_name === column.name)!
        expect(physical.is_nullable === 'NO', `${name}.${column.name} nullability`).toBe(column.notNull)
        if (is(column, PgEnumColumn)) {
          const members = (await admin.query(`SELECT array_agg(enumlabel::text ORDER BY enumsortorder) AS labels FROM pg_enum WHERE enumtypid = to_regtype($1)`, [`public.${physical.udt_name}`])).rows[0].labels
          expect(members, `${name}.${column.name} enum members`).toEqual((column as unknown as { enumValues: string[] }).enumValues)
        }
      }
      const primary = (await admin.query(`SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey) WHERE i.indrelid = $1::regclass AND i.indisprimary`, [`public.${name}`])).rows.map((r) => r.attname)
      expect(primary, `${name} primary key`).toEqual(['id'])
      const indexes = (await admin.query(`SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = $1 AND indexname NOT LIKE '%\\_pkey' AND indexname NOT LIKE '%\\_unique'`, [name])).rows.map((r) => r.indexname).sort()
      expect(indexes, `${name} indexes`).toEqual(config.indexes.map((i) => i.config.name as string).sort())
      const foreignKeys = Number((await admin.query(`SELECT count(*) AS n FROM pg_constraint WHERE conrelid = $1::regclass AND contype = 'f'`, [`public.${name}`])).rows[0].n)
      expect(foreignKeys, `${name} foreign keys`).toBe(config.foreignKeys.length)
    }
  })

  it('gives each relation exactly the access its manifest entry names', async () => {
    const report = await verifyEntries(admin, ALL.map((name) => manifest.get(name)!))
    expect(report.diffs.map((d) => `${d.kind}: ${d.text}`)).toEqual([])
    // The rollout gate reaches the row-security classes: the ten tenant tables and the two system-only tables, and none of them may be absent.
    expect(report.checked.sort()).toEqual([...TENANT, ...SYSTEM_ONLY].sort())
    expect(report.skipped).toEqual([])
    expect((await oracleDiffs(admin)).map((d) => `${d.kind}: ${d.text}`), 'all 23 entries, privileges included').toEqual([])
    // The freshness log is LATENT_UNREACHABLE: it must exist and be closed to both roles.
    for (const role of [RUNTIME_ROLE, SYSTEM_ROLE]) {
      for (const op of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        expect((await admin.query(`SELECT has_table_privilege($1, 'public.cba_intel_freshness_log', $2) AS ok`, [role, op])).rows[0].ok, `${role} ${op}`).toBe(false)
      }
    }
    const forced = (await admin.query(`SELECT relname FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relforcerowsecurity AND relname = ANY ($1)`, [ALL])).rows.map((r) => r.relname).sort()
    expect(forced).toEqual([...TENANT, ...SYSTEM_ONLY].sort())
  })

  describe('tenant tables, as the runtime role', () => {
    for (const name of TENANT) {
      it(`${name} isolates by organization for each command the manifest grants, and refuses the others`, async () => {
        const runtimeOps = operationsOf(manifest.get(name)!.requiredRuntimePrivileges)
        const inA = await insertRow(admin, name, { organization_id: ORG_A })
        const inB = await insertRow(admin, name, { organization_id: ORG_B })
        expect(await idsIn(admin, RUNTIME_ROLE, ORG_A, name)).toEqual([inA])
        expect(await idsIn(admin, RUNTIME_ROLE, ORG_B, name)).toEqual([inB])
        expect(await idsIn(admin, RUNTIME_ROLE, null, name), 'no organization context reads nothing').toEqual([])

        const insertAs = (org: string, row: string) => inRole(admin, RUNTIME_ROLE, org, async () => {
          const values = rowFor(name, { organization_id: row })
          const columns = Object.keys(values)
          return admin.query(`INSERT INTO public.${name} (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id::text AS id`, columns.map((c) => values[c]))
        })
        if (runtimeOps.has('INSERT')) {
          const created = (await insertAs(ORG_A, ORG_A)).rows[0].id as string
          expect(await idsIn(admin, RUNTIME_ROLE, ORG_A, name)).toContain(created)
          await expect(insertAs(ORG_A, ORG_B)).rejects.toThrow(/row-level security/)
        } else {
          await expect(insertAs(ORG_A, ORG_A)).rejects.toThrow(/permission denied/)
        }

        const update = (org: string, id: string) => inRole(admin, RUNTIME_ROLE, org, () => admin.query(`UPDATE public.${name} SET id = id WHERE id = $1`, [id]))
        if (runtimeOps.has('UPDATE')) {
          expect((await update(ORG_A, inA)).rowCount).toBe(1)
          expect((await update(ORG_A, inB)).rowCount, 'another organization\'s row').toBe(0)
        } else {
          await expect(update(ORG_A, inA)).rejects.toThrow(/permission denied/)
        }

        const remove = (org: string, id: string) => inRole(admin, RUNTIME_ROLE, org, () => admin.query(`DELETE FROM public.${name} WHERE id = $1`, [id]))
        if (runtimeOps.has('DELETE')) {
          expect((await remove(ORG_A, inB)).rowCount, 'another organization\'s row').toBe(0)
          expect((await remove(ORG_A, inA)).rowCount).toBe(1)
        } else {
          await expect(remove(ORG_A, inA)).rejects.toThrow(/permission denied/)
        }
        expect(runtimeOps.has('SELECT')).toBe(true)
      })
    }
  })

  it('keeps the customer-success tables to the system role, which may read and not write', async () => {
    for (const name of SYSTEM_ONLY) {
      const id = await insertRow(admin, name, { organization_id: ORG_A })
      await expect(idsIn(admin, RUNTIME_ROLE, ORG_A, name)).rejects.toThrow(/permission denied/)
      expect(await idsIn(admin, SYSTEM_ROLE, null, name)).toContain(id)
      const values = rowFor(name, { organization_id: ORG_A })
      const columns = Object.keys(values)
      await expect(inRole(admin, SYSTEM_ROLE, null, () => admin.query(`INSERT INTO public.${name} (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})`, columns.map((c) => values[c])))).rejects.toThrow(/permission denied/)
    }
  })

  it('serves the CBA intelligence domain as shared, tenant-less reference data with its keys and enums enforced', async () => {
    for (const name of CBA) {
      const overrides: Record<string, unknown> = {}
      const id = name === 'cba_intel_freshness_log' || !operationsOf(manifest.get(name)!.requiredRuntimePrivileges).has('INSERT')
        ? await insertRow(admin, name, overrides)
        : (await inRole(admin, RUNTIME_ROLE, ORG_A, async () => {
            const values = rowFor(name, overrides)
            const columns = Object.keys(values)
            return admin.query(`INSERT INTO public.${name} (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id::text AS id`, columns.map((c) => values[c]))
          })).rows[0].id as string
      parents.set(name, id)
      if (name !== 'cba_intel_freshness_log') {
        expect(await idsIn(admin, RUNTIME_ROLE, ORG_A, name), `${name} read in the organization that wrote it`).toContain(id)
        expect(await idsIn(admin, RUNTIME_ROLE, ORG_B, name), `${name} is shared with every organization`).toContain(id)
      }
    }
    await expect(idsIn(admin, RUNTIME_ROLE, ORG_A, 'cba_intel_freshness_log')).rejects.toThrow(/permission denied/)
    await expect(inRole(admin, RUNTIME_ROLE, ORG_A, () => admin.query(`DELETE FROM public.cba_intel_sources`))).rejects.toThrow(/permission denied/)
    expect((await inRole(admin, RUNTIME_ROLE, ORG_A, () => admin.query(`UPDATE public.cba_intel_sources SET is_active = false WHERE id = $1`, [parents.get('cba_intel_sources')]))).rowCount).toBe(1)

    const document = rowFor('cba_intel_documents')
    await expect(admin.query(`INSERT INTO public.cba_intel_documents (${Object.keys(document).map((c) => `"${c}"`).join(', ')}) VALUES (${Object.keys(document).map((_, i) => `$${i + 1}`).join(', ')})`, Object.values({ ...document, source_id: randomUUID() }))).rejects.toThrow(/foreign key/)
    await expect(admin.query(`UPDATE public.cba_intel_sources SET trust_tier = 'not_a_tier' WHERE id = $1`, [parents.get('cba_intel_sources')])).rejects.toThrow(/invalid input value for enum/)
    const slug = (await admin.query(`SELECT slug FROM public.cba_intel_sources WHERE id = $1`, [parents.get('cba_intel_sources')])).rows[0].slug
    const duplicate = rowFor('cba_intel_sources', { slug })
    await expect(admin.query(`INSERT INTO public.cba_intel_sources (${Object.keys(duplicate).map((c) => `"${c}"`).join(', ')}) VALUES (${Object.keys(duplicate).map((_, i) => `$${i + 1}`).join(', ')})`, Object.values(duplicate))).rejects.toThrow(/duplicate key/)
  })

  describe('the migrations and their rollbacks, in a clone of the database', () => {
    const platform = () => read('migrations-platform', `${PLATFORM}.sql`)
    const platformRollback = () => read('migrations-platform', `${PLATFORM}.rollback.sql`)
    const cache = () => read('migrations-cache', `${CACHE}.sql`)
    const cacheRollback = () => read('migrations-cache', `${CACHE}.rollback.sql`)

    async function run(client: pg.Client, sql: string) {
      await client.query('BEGIN')
      try {
        for (const statement of statementsOf(sql)) await client.query(statement)
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined)
        throw error
      }
    }
    const snapshot = async () => ({
      tables: (await scratch.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> ALL ($1) ORDER BY 1`, [ALL])).rows.map((r) => r.tablename),
      policies: Number((await scratch.query(`SELECT count(*) AS n FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid WHERE c.relname <> ALL ($1)`, [ALL])).rows[0].n),
      enums: (await scratch.query(`SELECT t.typname FROM pg_type t WHERE t.typnamespace = 'public'::regnamespace AND t.typtype = 'e' AND obj_description(t.oid, 'pg_type') IS DISTINCT FROM 'platform-migration:declared-absent-relations' ORDER BY 1`)).rows.map((r) => r.typname),
    })
    const present = async () => (await scratch.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY ($1) ORDER BY 1`, [ALL])).rows.map((r) => r.tablename)
    const taggedEnums = async () => Number((await scratch.query(`SELECT count(*) AS n FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typtype = 'e' AND obj_description(oid, 'pg_type') = 'platform-migration:declared-absent-relations'`)).rows[0].n)

    it('rolls back exactly what was created, and nothing else', async () => {
      const before = await snapshot()
      expect((await present()).sort()).toEqual([...ALL].sort())
      expect(await taggedEnums()).toBeGreaterThan(20)
      await run(scratch, cacheRollback())
      await run(scratch, platformRollback())
      expect(await present()).toEqual([])
      expect(await taggedEnums()).toBe(0)
      expect(await snapshot()).toEqual(before)
      await run(scratch, cacheRollback())
    })

    it('refuses to run over an existing relation or an enum of another shape, and changes nothing', async () => {
      await scratch.query(`CREATE TYPE public.cnesst_filing_status AS ENUM ('x', 'y')`)
      await expect(run(scratch, platform())).rejects.toThrow(/enum type cnesst_filing_status exists with members other than the declared ones/)
      expect(await present()).toEqual([])
      await scratch.query('DROP TYPE public.cnesst_filing_status')

      await scratch.query(`CREATE TABLE public.cnesst_filings (id integer)`)
      await expect(run(scratch, platform())).rejects.toThrow(/relations already exist and are not replaced: \{cnesst_filings\}/)
      expect(await present()).toEqual(['cnesst_filings'])
      await scratch.query('DROP TABLE public.cnesst_filings')
      expect(await taggedEnums()).toBe(0)
    })

    it('re-applies to the declared shape with row security and policies in place, leaving the grants to the manifest activation', async () => {
      await run(scratch, platform())
      await run(scratch, cache())
      expect((await present()).sort()).toEqual([...ALL].sort())
      const report = await verifyEntries(scratch, ALL.map((name) => manifest.get(name)!))
      expect(report.skipped).toEqual([])
      // Every difference is a privilege the activation has not yet granted: row security, forcing and the policies are all in place.
      const diffs = await oracleDiffs(scratch)
      expect(diffs.every((d) => d.kind === 'MISSING' && /^union_eyes_(runtime|system) (SELECT|INSERT|UPDATE|DELETE) on /.test(d.text))).toBe(true)
      const wantedFor = (names: string[]) => names.reduce((sum, name) => {
        const entry = manifest.get(name)!
        return sum + operationsOf(entry.requiredRuntimePrivileges).size + operationsOf(entry.requiredSystemPrivileges).size
      }, 0)
      const wanted = wantedFor(ALL)
      expect(wanted).toBeGreaterThan(60)
      expect(diffs).toHaveLength(wanted)
      expect(report.diffs, 'the gate reaches the twelve row-security tables only').toHaveLength(wantedFor([...TENANT, ...SYSTEM_ONLY]))
      const policies = Number((await scratch.query(`SELECT count(*) AS n FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid WHERE c.relname = ANY ($1)`, [ALL])).rows[0].n)
      await run(scratch, cache())
      expect(Number((await scratch.query(`SELECT count(*) AS n FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid WHERE c.relname = ANY ($1)`, [ALL])).rows[0].n), 'the closure is idempotent').toBe(policies)
      await expect(run(scratch, platform())).rejects.toThrow(/relations already exist and are not replaced/)
    })

    it('refuses to remove a relation that holds rows', async () => {
      await scratch.query(`INSERT INTO public.cnesst_filings (organization_id, filing_type, legal_basis, title, description) VALUES ($1, 'workplace_accident', 'basis', 'title', 'description')`, [randomUUID()])
      await run(scratch, cacheRollback())
      await expect(run(scratch, platformRollback())).rejects.toThrow(/rollback declared-absent-relations refuses: cnesst_filings holds rows/)
      expect((await present()).sort()).toEqual([...ALL].sort())
      await scratch.query('DELETE FROM public.cnesst_filings')
      await run(scratch, platformRollback())
      expect(await present()).toEqual([])
    })
  })
})

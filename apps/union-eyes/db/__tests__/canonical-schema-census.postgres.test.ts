/**
 * Canonical-schema census (UE-CONV-H-007).
 *
 * The Django-created relations the runtime writes were authored as stubs, and the Drizzle declarations the
 * application queries describe a different shape. This compares every Drizzle table declaration with the REAL
 * schema produced by Django `migrate` plus the approved bootstrap, and classifies each difference that would make a
 * runtime read or write fail:
 *
 *   TABLE_ABSENT          the declared relation does not exist
 *   COLUMNS_MISSING       the declaration selects or writes columns the relation lacks
 *   REQUIRED_UNDECLARED   the relation has a NOT NULL column with no default that the declaration cannot supply,
 *                         so every INSERT through the declaration fails
 *
 * Skipped unless UE_CENSUS_URL points at a disposable database prepared as in UE-FINAL-CONVERGENCE-CHECKPOINT-3.
 * The committed baseline is a ratchet: a table may leave it, never join it or gain a new defect. Regenerate with
 * UE_CENSUS_WRITE=1 only after fixing defects, so the baseline can only shrink.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { describe, expect, it } from 'vitest'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import { is } from 'drizzle-orm'
import * as declarations from '../schema'

const URL = process.env.UE_CENSUS_URL
const BASELINE = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/register/ue-canonical-schema-census.json')

type Defect = 'TABLE_ABSENT' | 'COLUMNS_MISSING' | 'REQUIRED_UNDECLARED'
interface Entry { table: string; defects: Defect[]; columnsMissing: string[]; requiredUndeclared: string[] }

async function census(client: pg.Client): Promise<Entry[]> {
  const rows = (
    await client.query<{ table_schema: string; table_name: string; column_name: string; is_nullable: string; column_default: string | null; is_generated: string; is_identity: string }>(
      `SELECT table_schema, table_name, column_name, is_nullable, column_default, is_generated, is_identity
         FROM information_schema.columns WHERE table_schema NOT IN ('pg_catalog', 'information_schema')`,
    )
  ).rows
  const live = new Map<string, typeof rows>()
  for (const r of rows) {
    const key = r.table_schema === 'public' ? r.table_name : `${r.table_schema}.${r.table_name}`
    live.set(key, [...(live.get(key) ?? []), r])
  }
  const seen = new Set<string>()
  const out: Entry[] = []
  for (const value of Object.values(declarations as Record<string, unknown>)) {
    if (!is(value, PgTable)) continue
    const config = getTableConfig(value)
    const qualified = config.schema && config.schema !== 'public' ? `${config.schema}.${config.name}` : config.name
    if (seen.has(qualified)) continue
    seen.add(qualified)
    const cols = live.get(qualified)
    if (!cols) {
      out.push({ table: qualified, defects: ['TABLE_ABSENT'], columnsMissing: [], requiredUndeclared: [] })
      continue
    }
    const liveNames = new Set(cols.map((c) => c.column_name))
    const declared = new Set(config.columns.map((c) => c.name))
    const columnsMissing = [...declared].filter((c) => !liveNames.has(c)).sort()
    const requiredUndeclared = cols
      .filter((c) => c.is_nullable === 'NO' && c.column_default === null && c.is_generated === 'NEVER' && c.is_identity === 'NO' && !declared.has(c.column_name))
      .map((c) => c.column_name)
      .sort()
    const defects: Defect[] = []
    if (columnsMissing.length) defects.push('COLUMNS_MISSING')
    if (requiredUndeclared.length) defects.push('REQUIRED_UNDECLARED')
    if (defects.length) out.push({ table: qualified, defects, columnsMissing, requiredUndeclared })
  }
  return out.sort((a, b) => a.table.localeCompare(b.table))
}

describe.skipIf(!URL)('canonical schema census against the real Django plus bootstrap schema', () => {
  it('records every declaration the real schema cannot serve, and no table gains a defect', async () => {
    const client = new pg.Client({ connectionString: URL })
    await client.connect()
    try {
      const current = await census(client)
      if (process.env.UE_CENSUS_WRITE === '1') {
        const lines = current.map((e) => '    ' + JSON.stringify(e)).join(',\n')
        writeFileSync(BASELINE, `{\n  "schemaVersion": 1,\n  "note": "Ratchet: entries may only be removed. See UE-CONV-H-007.",\n  "entries": [\n${lines}\n  ]\n}\n`)
        return
      }
      const baseline = new Map<string, Entry>((JSON.parse(readFileSync(BASELINE, 'utf8')).entries as Entry[]).map((e) => [e.table, e]))
      const regressions: string[] = []
      for (const e of current) {
        const b = baseline.get(e.table)
        if (!b) { regressions.push(`${e.table}: new defect ${e.defects.join(',')}`); continue }
        for (const d of e.defects) if (!b.defects.includes(d)) regressions.push(`${e.table}: new defect ${d}`)
        for (const c of e.columnsMissing) if (!b.columnsMissing.includes(c)) regressions.push(`${e.table}: column ${c} missing`)
        for (const c of e.requiredUndeclared) if (!b.requiredUndeclared.includes(c)) regressions.push(`${e.table}: required column ${c} undeclared`)
      }
      expect(regressions).toEqual([])
    } finally {
      await client.end()
    }
  }, 120_000)

  it('documents serves its declaration: the org_id mirror exists and can never name another tenant (platform 0016)', async () => {
    const client = new pg.Client({ connectionString: URL })
    await client.connect()
    try {
      const org = '00000000-0000-4000-8000-0000000000a1'
      const other = '00000000-0000-4000-8000-0000000000a2'
      await client.query(`INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
        VALUES ($1,'census-doc','census-doc','local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1) ON CONFLICT (id) DO NOTHING`, [org])
      const cols = (await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'documents'`)).rows.map((r) => r.column_name)
      expect(cols).toContain('org_id')
      // The Django stub has no defaults, so a probe row must supply every required column itself.
      const required = (await client.query(
        `SELECT c.column_name, c.data_type, c.udt_name FROM information_schema.columns c
          WHERE c.table_schema = 'public' AND c.table_name = 'documents' AND c.is_nullable = 'NO' AND c.column_default IS NULL`,
      )).rows as { column_name: string; data_type: string; udt_name: string }[]
      const sample = async (c: { data_type: string; udt_name: string }): Promise<string> => {
        if (c.data_type === 'USER-DEFINED') return `'${(await client.query(`SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = $1 ORDER BY e.enumsortorder LIMIT 1`, [c.udt_name])).rows[0].enumlabel}'`
        if (c.data_type === 'uuid') return 'gen_random_uuid()'
        if (c.data_type.startsWith('timestamp') || c.data_type === 'date') return 'now()'
        if (c.data_type === 'boolean') return 'false'
        if (/int|numeric|double|real/.test(c.data_type)) return '0'
        if (c.data_type === 'jsonb' || c.data_type === 'json') return "'{}'"
        if (c.data_type === 'ARRAY') return "'{}'"
        return "'x'"
      }
      const insert = async (orgId: string, mirror: string) => {
        const values: Record<string, string> = {}
        for (const c of required) values[c.column_name] = await sample(c)
        values.organization_id = `'${orgId}'`
        values.org_id = `'${mirror}'`
        const names = Object.keys(values)
        return client.query(`INSERT INTO documents (${names.join(', ')}) VALUES (${names.map((n) => values[n]).join(', ')})`)
      }
      await expect(insert(org, other)).rejects.toThrow(/documents_org_id_mirrors_organization_id/)
      await insert(org, org)
    } finally {
      await client.end()
    }
  }, 60_000)
})

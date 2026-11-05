/**
 * Native PostgreSQL qualification of cache migration 0031_feature_flags_attribution_columns: applied to the preceding schema
 * (a feature_flags table without the attribution columns), idempotent, reversible, fail-closed without its table, and present
 * with the runtime role's privileges on the combined database. Needs UE_AUTHORITY_COMBINED_URL; skipped when it is not set.
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const URL_ = process.env.UE_AUTHORITY_COMBINED_URL
const dir = join(__dirname, '..', 'migrations-cache')
const up = readFileSync(join(dir, '0031_feature_flags_attribution_columns.sql'), 'utf8')
const down = readFileSync(join(dir, '0031_feature_flags_attribution_columns.rollback.sql'), 'utf8')

describe.skipIf(!URL_)('migration 0031 on native PostgreSQL', () => {
  const scratch = `m0031_${randomUUID().replace(/-/g, '').slice(0, 12)}`
  let admin: pg.Client
  let db: pg.Client
  const columns = async () =>
    (await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name='feature_flags' AND column_name IN ('created_by','last_modified_by') ORDER BY 1`)).rows.map((r) => r.column_name as string)

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL_ })
    await admin.connect()
    await admin.query(`CREATE DATABASE ${scratch}`)
    const u = new globalThis.URL(URL_ as string)
    u.pathname = `/${scratch}`
    db = new pg.Client({ connectionString: u.toString() })
    await db.connect()
    await db.query(`CREATE TABLE public.feature_flags (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, enabled boolean NOT NULL DEFAULT false)`)
    await db.query(`INSERT INTO feature_flags (name, enabled) VALUES ('existing', true)`)
  })

  afterAll(async () => {
    await db?.end()
    await admin?.query(`DROP DATABASE IF EXISTS ${scratch} WITH (FORCE)`)
    await admin?.end()
  })

  it('adds nullable attribution columns and leaves existing rows untouched', async () => {
    expect(await columns()).toEqual([])
    await db.query(up)
    expect(await columns()).toEqual(['created_by', 'last_modified_by'])
    const row = (await db.query(`SELECT enabled, created_by, last_modified_by FROM feature_flags WHERE name='existing'`)).rows[0]
    expect(row).toEqual({ enabled: true, created_by: null, last_modified_by: null })
  })

  it('is idempotent and records who changed a flag', async () => {
    await db.query(up)
    await db.query(`UPDATE feature_flags SET created_by = 'ue-qa-admin-primary', last_modified_by = 'ue-qa-admin-primary' WHERE name='existing'`)
    expect((await db.query(`SELECT created_by FROM feature_flags WHERE name='existing'`)).rows[0].created_by).toBe('ue-qa-admin-primary')
  })

  it('rolls back by dropping the columns, then re-applies', async () => {
    await db.query(down)
    expect(await columns()).toEqual([])
    await db.query(up)
    expect(await columns()).toEqual(['created_by', 'last_modified_by'])
  })

  it('fails closed when the table does not exist', async () => {
    await db.query('ALTER TABLE public.feature_flags RENAME TO feature_flags_moved')
    await expect(db.query(up)).rejects.toThrow(/fail-closed/)
    await db.query('ALTER TABLE public.feature_flags_moved RENAME TO feature_flags')
  })

  it('holds on the combined database with the runtime role able to read the columns the ORM selects', async () => {
    const combined = new pg.Client({ connectionString: URL_ })
    await combined.connect()
    try {
      const names = (await combined.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='feature_flags' AND column_name IN ('created_by','last_modified_by')`)).rows
      expect(names).toHaveLength(2)
      expect((await combined.query(`SELECT has_column_privilege('union_eyes_runtime','public.feature_flags','created_by','SELECT') AS ok`)).rows[0].ok).toBe(true)
    } finally {
      await combined.end()
    }
  })
})

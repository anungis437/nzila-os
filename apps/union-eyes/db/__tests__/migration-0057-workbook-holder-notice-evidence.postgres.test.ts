/**
 * Native PostgreSQL qualification of platform 0057_workbook_holder_notice_evidence.
 *
 * On a disposable database owned by a non-superuser role, 0055 is applied over a holder table that already holds rows (one recorded as
 * 'notified', one not), then 0057 twice. Every notice recorded before evidence existed must come out 'self_reported', never
 * 'delivery_verified'; the constraint must refuse a delivery-verified row without its provider evidence, evidence on a row with no notice,
 * and an unknown level; and the rollback must remove only what 0057 added. Needs UE_AUTHORITY_COMBINED_URL; skipped when it is not set.
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const URL_ = process.env.UE_AUTHORITY_COMBINED_URL
const sql = (name: string) => readFileSync(join(__dirname, '..', 'migrations-platform', `${name}.sql`), 'utf8')
const withDb = (url: string, name: string) => { const u = new globalThis.URL(url); u.pathname = `/${name}`; return u.toString() }

describe.skipIf(!URL_)('migration 0057 on native PostgreSQL', () => {
  const scratch = `m0057_${randomUUID().replace(/-/g, '').slice(0, 10)}`
  const owner = `m0057_owner_${randomUUID().replace(/-/g, '').slice(0, 8)}`
  const told = randomUUID()
  const untold = randomUUID()
  let admin: pg.Client
  let db: pg.Client

  const migrate = async (text: string) => {
    await db.query(`SET ROLE ${owner}`)
    try { await db.query(text) } finally { await db.query('RESET ROLE') }
  }
  const evidence = async (id: string) => (await db.query('SELECT notice_state, notice_evidence, notice_verified_at, notice_verified_by, notice_provider_reference FROM workbook_memory_holders WHERE id = $1', [id])).rows[0]
  const insert = (over: Record<string, unknown>) => {
    const columns = ['id', 'role', 'responsibility', ...Object.keys(over)]
    const values = [randomUUID(), 'Treasurer', 'Payroll', ...Object.values(over)]
    return db.query(`INSERT INTO workbook_memory_holders (${columns.join(', ')}) VALUES (${values.map((_, i) => `$${i + 1}`).join(', ')})`, values)
  }
  const recorded = { notice_state: 'notified', notified_at: new Date(), notified_by: 'user_steward', notice_channel: 'email' }

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL_ })
    await admin.connect()
    await admin.query(`CREATE ROLE ${owner} NOLOGIN`)
    await admin.query(`CREATE DATABASE ${scratch} OWNER ${owner}`)
    db = new pg.Client({ connectionString: withDb(URL_ as string, scratch) })
    await db.connect()
    await db.query(`GRANT ALL ON SCHEMA public TO ${owner}`)
    await migrate(`CREATE TABLE public.workbook_memory_holders (id uuid PRIMARY KEY, role varchar(255) NOT NULL, responsibility text NOT NULL, display_name text, notes text);`)
    await migrate(sql('0055_workbook_holder_notice'))
    await db.query(`INSERT INTO workbook_memory_holders (id, role, responsibility, display_name, notice_state, notified_at, notified_by, notice_channel) VALUES ($1, 'A', 'x', 'Named', 'notified', now(), 'user_steward', 'email')`, [told])
    await db.query(`INSERT INTO workbook_memory_holders (id, role, responsibility, display_name) VALUES ($1, 'B', 'y', 'Also named')`, [untold])
    await migrate(sql('0057_workbook_holder_notice_evidence'))
    await migrate(sql('0057_workbook_holder_notice_evidence'))
  })
  afterAll(async () => {
    await db?.end()
    await admin?.query(`DROP DATABASE IF EXISTS ${scratch} WITH (FORCE)`)
    await admin?.query(`DROP ROLE IF EXISTS ${owner}`)
    await admin?.end()
  })

  it('relabels a notice recorded earlier as a statement, upgrades nothing, and leaves an unrecorded row with none', async () => {
    expect(await evidence(told)).toEqual({ notice_state: 'notified', notice_evidence: 'self_reported', notice_verified_at: null, notice_verified_by: null, notice_provider_reference: null })
    expect(await evidence(untold)).toMatchObject({ notice_state: 'not_recorded', notice_evidence: 'none' })
    expect((await db.query(`SELECT count(*)::int AS n FROM workbook_memory_holders WHERE notice_evidence = 'delivery_verified'`)).rows[0].n).toBe(0)
  })

  it('refuses to apply over a database that has not had 0055', async () => {
    const bare = `m0057b_${randomUUID().replace(/-/g, '').slice(0, 8)}`
    await admin.query(`CREATE DATABASE ${bare} OWNER ${owner}`)
    const other = new pg.Client({ connectionString: withDb(URL_ as string, bare) })
    await other.connect()
    try {
      await other.query(`GRANT ALL ON SCHEMA public TO ${owner}`)
      await other.query(`SET ROLE ${owner}`)
      await other.query('CREATE TABLE public.workbook_memory_holders (id uuid PRIMARY KEY, role varchar(255) NOT NULL, responsibility text NOT NULL)')
      await expect(other.query(sql('0057_workbook_holder_notice_evidence'))).rejects.toThrow(/platform 0055 has not been applied/)
    } finally {
      await other.end()
      await admin.query(`DROP DATABASE IF EXISTS ${bare} WITH (FORCE)`)
    }
  })

  it('accepts each of the three levels with the state that goes with it', async () => {
    await insert({})
    await insert({ ...recorded, notice_evidence: 'self_reported' })
    await insert({ ...recorded, notice_evidence: 'delivery_verified', notice_verified_at: new Date(), notice_verified_by: 'mail-provider', notice_provider_reference: 'ev-9' })
  })

  it('refuses a delivery-verified row without its provider evidence, and provider evidence on anything else', async () => {
    await expect(insert({ ...recorded, notice_evidence: 'delivery_verified' })).rejects.toThrow(/notice_evidence_check/)
    await expect(insert({ ...recorded, notice_evidence: 'delivery_verified', notice_verified_at: new Date(), notice_verified_by: 'p' })).rejects.toThrow(/notice_evidence_check/)
    await expect(insert({ ...recorded, notice_evidence: 'self_reported', notice_verified_at: new Date(), notice_verified_by: 'p', notice_provider_reference: 'r' })).rejects.toThrow(/notice_evidence_check/)
  })

  it('refuses evidence on a row with no notice, a notice with no evidence, and an unknown level', async () => {
    await expect(insert({ notice_evidence: 'self_reported' })).rejects.toThrow(/notice_evidence_check/)
    await expect(insert({ ...recorded })).rejects.toThrow(/notice_evidence_check/)
    await expect(insert({ ...recorded, notice_evidence: 'confirmed' })).rejects.toThrow(/notice_evidence_check/)
  })

  it('does not let a recorded statement be quietly turned into a delivery without the evidence', async () => {
    await expect(db.query(`UPDATE workbook_memory_holders SET notice_evidence = 'delivery_verified' WHERE id = $1`, [told])).rejects.toThrow(/notice_evidence_check/)
    expect((await evidence(told)).notice_evidence).toBe('self_reported')
  })

  it('rolls back only what it added, keeping 0055\'s record, and re-applies with the same relabelling', async () => {
    await migrate(sql('0057_workbook_holder_notice_evidence.rollback'))
    expect((await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'workbook_memory_holders' AND column_name LIKE 'notice_%' AND column_name IN ('notice_evidence', 'notice_verified_at', 'notice_verified_by', 'notice_provider_reference')`)).rows).toEqual([])
    expect((await db.query(`SELECT notice_state FROM workbook_memory_holders WHERE id = $1`, [told])).rows[0].notice_state).toBe('notified')
    await migrate(sql('0057_workbook_holder_notice_evidence'))
    expect((await evidence(told)).notice_evidence).toBe('self_reported')
  })
})

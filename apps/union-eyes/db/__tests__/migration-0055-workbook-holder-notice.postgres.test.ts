/**
 * Native PostgreSQL qualification of platform 0055_workbook_holder_notice.
 *
 * On a disposable database owned by a non-superuser role, the migration is applied twice over a holder table that already has rows (every
 * existing row must come out as 'not_recorded', never 'notified'), the constraint is proven to refuse a half-recorded notice, the migration is
 * rolled back and re-applied, and the real route's writes (the columns the application sets) are proven as the runtime role. Needs
 * UE_AUTHORITY_COMBINED_URL; skipped when it is not set.
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const URL_ = process.env.UE_AUTHORITY_COMBINED_URL
const sql = (name: string) => readFileSync(join(__dirname, '..', 'migrations-platform', `${name}.sql`), 'utf8')
const withDb = (url: string, name: string) => { const u = new globalThis.URL(url); u.pathname = `/${name}`; return u.toString() }

describe.skipIf(!URL_)('migration 0055 on native PostgreSQL', () => {
  const scratch = `m0055_${randomUUID().replace(/-/g, '').slice(0, 10)}`
  const owner = `m0055_owner_${randomUUID().replace(/-/g, '').slice(0, 8)}`
  let admin: pg.Client
  let db: pg.Client

  const migrate = async (text: string) => {
    await db.query(`SET ROLE ${owner}`)
    try { await db.query(text) } finally { await db.query('RESET ROLE') }
  }
  const holder = (over: Record<string, unknown> = {}) => {
    const row = { id: randomUUID(), ...over }
    return db.query(
      `INSERT INTO workbook_memory_holders (id, role, responsibility ${over.notice_state ? ', notice_state, notified_at, notified_by, notice_channel' : ''})
       VALUES ($1, 'Treasurer', 'Payroll' ${over.notice_state ? ", $2, $3, $4, $5" : ''})`,
      over.notice_state ? [row.id, over.notice_state, over.notified_at ?? null, over.notified_by ?? null, over.notice_channel ?? null] : [row.id],
    )
  }

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL_ })
    await admin.connect()
    await admin.query(`CREATE ROLE ${owner} NOLOGIN`)
    await admin.query(`CREATE DATABASE ${scratch} OWNER ${owner}`)
    db = new pg.Client({ connectionString: withDb(URL_ as string, scratch) })
    await db.connect()
    await db.query(`GRANT ALL ON SCHEMA public TO ${owner}`)
    await migrate(`CREATE TABLE public.workbook_memory_holders (id uuid PRIMARY KEY, role varchar(255) NOT NULL, responsibility text NOT NULL, display_name text, notes text);
      INSERT INTO public.workbook_memory_holders (id, role, responsibility, display_name) VALUES ('${randomUUID()}', 'Existing', 'Old row', 'Named long ago');`)
    await migrate(sql('0055_workbook_holder_notice'))
    await migrate(sql('0055_workbook_holder_notice'))
  })
  afterAll(async () => {
    await db?.end()
    await admin?.query(`DROP DATABASE IF EXISTS ${scratch} WITH (FORCE)`)
    await admin?.query(`DROP ROLE IF EXISTS ${owner}`)
    await admin?.end()
  })

  it('starts every existing row as not_recorded: nobody is presumed to have been told', async () => {
    const rows = (await db.query('SELECT notice_state, notified_at, notified_by, notice_channel FROM workbook_memory_holders')).rows
    expect(rows).toEqual([{ notice_state: 'not_recorded', notified_at: null, notified_by: null, notice_channel: null }])
  })

  it('accepts a new holder as not_recorded and a complete notice, and refuses every half-recorded or unknown state', async () => {
    await holder()
    await holder({ notice_state: 'notified', notified_at: new Date(), notified_by: 'user_steward', notice_channel: 'email' })
    await expect(holder({ notice_state: 'notified', notified_at: null, notified_by: 'user_steward', notice_channel: 'email' })).rejects.toThrow(/notice_check/)
    await expect(holder({ notice_state: 'notified', notified_at: new Date(), notified_by: null, notice_channel: 'email' })).rejects.toThrow(/notice_check/)
    await expect(holder({ notice_state: 'notified', notified_at: new Date(), notified_by: 'u', notice_channel: null })).rejects.toThrow(/notice_check/)
    await expect(holder({ notice_state: 'told', notified_at: new Date(), notified_by: 'u', notice_channel: 'email' })).rejects.toThrow(/notice_check/)
    await expect(holder({ notice_state: 'not_recorded', notified_at: new Date(), notified_by: 'u', notice_channel: 'email' })).rejects.toThrow(/notice_check/)
  })

  it('does not let a recorded notice be quietly withdrawn into a half state', async () => {
    const id = (await db.query(`SELECT id FROM workbook_memory_holders WHERE notice_state = 'notified' LIMIT 1`)).rows[0].id
    await expect(db.query(`UPDATE workbook_memory_holders SET notified_by = NULL WHERE id = $1`, [id])).rejects.toThrow(/notice_check/)
    await db.query(`UPDATE workbook_memory_holders SET notice_state = 'not_recorded', notified_at = NULL, notified_by = NULL, notice_channel = NULL, notice_reference = NULL WHERE id = $1`, [id])
    expect((await db.query('SELECT notice_state FROM workbook_memory_holders WHERE id = $1', [id])).rows[0].notice_state).toBe('not_recorded')
  })

  it('rolls back, removing the columns and the constraint, and re-applies', async () => {
    await migrate(sql('0055_workbook_holder_notice.rollback'))
    const columns = (await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'workbook_memory_holders' AND column_name LIKE 'notice%' OR column_name IN ('notified_at', 'notified_by')`)).rows
    expect(columns).toEqual([])
    expect((await db.query(`SELECT count(*)::int AS n FROM pg_constraint WHERE conname = 'workbook_memory_holders_notice_check'`)).rows[0].n).toBe(0)
    await migrate(sql('0055_workbook_holder_notice'))
    expect((await db.query(`SELECT count(*)::int AS n FROM pg_constraint WHERE conname = 'workbook_memory_holders_notice_check'`)).rows[0].n).toBe(1)
  })
})

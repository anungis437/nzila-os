/**
 * Native PostgreSQL qualification of platform 0053_email_address_suppressions and cache 0043_email_address_suppressions_rls_closure.
 *
 * On a disposable database owned by a non-superuser role, the migrations are applied twice and the platform-wide suppression list is
 * proven system-only AS the application roles: no tenant (runtime) session can read or write it; the system role reads, inserts and
 * updates (the webhook's upsert, which clears a lift) but cannot delete; an address is stored once, as a hash only; the lift columns
 * move together. Rollbacks are proven. Needs UE_AUTHORITY_COMBINED_URL; skipped when it is not set.
 */
import { randomUUID, createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const URL_ = process.env.UE_AUTHORITY_COMBINED_URL
const sql = (dir: string, name: string) => readFileSync(join(__dirname, '..', dir, `${name}.sql`), 'utf8')
const P = (rollback = false) => sql('migrations-platform', `0053_email_address_suppressions${rollback ? '.rollback' : ''}`)
const C = (rollback = false) => sql('migrations-cache', `0043_email_address_suppressions_rls_closure${rollback ? '.rollback' : ''}`)
const sha = (t: string) => createHash('sha256').update(t.toLowerCase(), 'utf8').digest('hex')
const withDb = (url: string, name: string) => { const u = new globalThis.URL(url); u.pathname = `/${name}`; return u.toString() }

describe.skipIf(!URL_)('migrations 0053 and 0043 on native PostgreSQL', () => {
  const scratch = `m0053_${randomUUID().replace(/-/g, '').slice(0, 10)}`
  const owner = `m0053_owner_${randomUUID().replace(/-/g, '').slice(0, 8)}`
  const org = randomUUID()
  let admin: pg.Client
  let db: pg.Client

  const migrate = async (text: string) => {
    await db.query(`SET ROLE ${owner}`)
    try { await db.query(text) } finally { await db.query('RESET ROLE') }
  }
  const as = async <T>(role: string, fn: () => Promise<T>, commit = false): Promise<T> => {
    await db.query('BEGIN')
    try {
      await db.query(`SET LOCAL ROLE ${role}`)
      const value = await fn()
      await db.query(commit ? 'COMMIT' : 'ROLLBACK')
      return value
    } catch (error) {
      await db.query('ROLLBACK')
      throw error
    }
  }
  const upsert = (address: string, reason = 'complaint', event = 'evt-1') =>
    db.query(
      `INSERT INTO email_address_suppressions (address_sha256, reason, source_organization_id, first_provider_event_id, last_provider_event_id)
       VALUES ($1, $2, $3, $4, $4)
       ON CONFLICT (address_sha256) DO UPDATE SET reason = EXCLUDED.reason, last_provider_event_id = EXCLUDED.last_provider_event_id, updated_at = now(), lifted_at = NULL, lifted_by = NULL, lift_reason = NULL`,
      [sha(address), reason, org, event],
    )

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL_ })
    await admin.connect()
    await admin.query(`CREATE ROLE ${owner} NOLOGIN`)
    await admin.query(`CREATE DATABASE ${scratch} OWNER ${owner}`)
    db = new pg.Client({ connectionString: withDb(URL_ as string, scratch) })
    await db.connect()
    await db.query(`GRANT ALL ON SCHEMA public TO ${owner}`)
    await migrate(`CREATE TABLE organizations (id uuid PRIMARY KEY); INSERT INTO organizations VALUES ('${org}');`)
    await migrate(P())
    await migrate(P())
    await db.query(`GRANT SELECT, INSERT, UPDATE ON email_address_suppressions TO union_eyes_system`)
    await db.query(`GRANT SELECT, INSERT, UPDATE ON email_address_suppressions TO union_eyes_runtime`) // granted on purpose: row security alone must hold
    await migrate(C())
    await migrate(C())
  })
  afterAll(async () => {
    await db?.end()
    await admin?.query(`DROP DATABASE IF EXISTS ${scratch} WITH (FORCE)`)
    await admin?.query(`DROP ROLE IF EXISTS ${owner}`)
    await admin?.end()
  })

  it('forces row security with one system-only policy', async () => {
    expect((await db.query(`SELECT policyname, roles::text[] AS roles FROM pg_policies WHERE tablename = 'email_address_suppressions'`)).rows).toEqual([{ policyname: 'ue_system_full_access', roles: ['union_eyes_system'] }])
    expect((await db.query(`SELECT relforcerowsecurity FROM pg_class WHERE oid = 'email_address_suppressions'::regclass`)).rows[0].relforcerowsecurity).toBe(true)
  })

  it('lets the system role record, renew and clear a suppression, storing a hash and never the address', async () => {
    await as('union_eyes_system', () => upsert('Person@example.com'), true)
    await as('union_eyes_system', () => db.query(`UPDATE email_address_suppressions SET lifted_at = now(), lifted_by = 'admin', lift_reason = 'confirmed'`), true)
    await as('union_eyes_system', () => upsert('person@EXAMPLE.com', 'complaint', 'evt-2'), true)
    const rows = (await as('union_eyes_system', () => db.query(`SELECT address_sha256, lifted_at, lifted_by, last_provider_event_id, first_provider_event_id FROM email_address_suppressions`))).rows
    expect(rows).toEqual([{ address_sha256: sha('person@example.com'), lifted_at: null, lifted_by: null, last_provider_event_id: 'evt-2', first_provider_event_id: 'evt-1' }])
    expect(JSON.stringify((await db.query(`SELECT * FROM email_address_suppressions`)).rows)).not.toContain('example.com')
  })

  it('hides the list from, and refuses writes by, a tenant session even where DML was granted', async () => {
    expect(await as('union_eyes_runtime', async () => (await db.query(`SELECT 1 FROM email_address_suppressions`)).rowCount)).toBe(0)
    await expect(as('union_eyes_runtime', () => upsert('x@example.com'))).rejects.toThrow(/row-level security/)
  })

  it('refuses a delete by any application role, a malformed hash, an unknown reason and a half-recorded lift', async () => {
    await expect(as('union_eyes_system', () => db.query(`DELETE FROM email_address_suppressions`))).rejects.toThrow(/permission denied/)
    await expect(as('union_eyes_system', () => db.query(`INSERT INTO email_address_suppressions (address_sha256, reason) VALUES ('nothex', 'complaint')`))).rejects.toThrow(/email_address_suppressions_hash_check/)
    await expect(as('union_eyes_system', () => db.query(`INSERT INTO email_address_suppressions (address_sha256, reason) VALUES ('${sha('y@example.com')}', 'spam')`))).rejects.toThrow(/email_address_suppressions_reason_check/)
    await expect(as('union_eyes_system', () => db.query(`UPDATE email_address_suppressions SET lifted_at = now()`))).rejects.toThrow(/email_address_suppressions_lift_check/)
  })

  it('rolls back both migrations and re-applies them', async () => {
    await migrate(C(true))
    expect((await db.query(`SELECT count(*)::int AS n FROM pg_policies WHERE tablename = 'email_address_suppressions'`)).rows[0].n).toBe(0)
    await migrate(P(true))
    expect((await db.query(`SELECT to_regclass('public.email_address_suppressions') AS t`)).rows[0].t).toBeNull()
    await migrate(P())
    expect((await db.query(`SELECT to_regclass('public.email_address_suppressions') AS t`)).rows[0].t).not.toBeNull()
  })
})
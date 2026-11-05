/**
 * Native PostgreSQL qualification of platform 0052_shared_clause_versions and cache 0042_shared_clause_versions_rls_closure.
 *
 * On a disposable database owned by a non-superuser role (so FORCE ROW LEVEL SECURITY applies to the migration role as it does in a
 * deployment), the migrations are applied twice (idempotency) and the history is proven append-only AS union_eyes_runtime and
 * union_eyes_system: an organization writes and reads only its own versions, cannot change or remove one, and cannot write another
 * organization's; the same version cannot be recorded twice; and the history outlives a clause that no longer exists. Rollbacks are
 * proven. Needs UE_AUTHORITY_COMBINED_URL; skipped when it is not set. ue_create_direct_org_rls_policy is copied from that database.
 */
import { randomUUID, createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const URL_ = process.env.UE_AUTHORITY_COMBINED_URL
const sql = (dir: string, name: string) => readFileSync(join(__dirname, '..', dir, `${name}.sql`), 'utf8')
const P = (rollback = false) => sql('migrations-platform', `0052_shared_clause_versions${rollback ? '.rollback' : ''}`)
const C = (rollback = false) => sql('migrations-cache', `0042_shared_clause_versions_rls_closure${rollback ? '.rollback' : ''}`)
const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex')
const withDb = (url: string, name: string) => { const u = new globalThis.URL(url); u.pathname = `/${name}`; return u.toString() }

describe.skipIf(!URL_)('migrations 0052 and 0042 on native PostgreSQL', () => {
  const scratch = `m0052_${randomUUID().replace(/-/g, '').slice(0, 10)}`
  const owner = `m0052_owner_${randomUUID().replace(/-/g, '').slice(0, 8)}`
  const orgA = randomUUID()
  const orgB = randomUUID()
  const clause = randomUUID()
  let admin: pg.Client
  let db: pg.Client

  const migrate = async (text: string) => {
    await db.query(`SET ROLE ${owner}`)
    try { await db.query(text) } finally { await db.query('RESET ROLE') }
  }
  const as = async <T>(role: string, org: string | undefined, fn: () => Promise<T>): Promise<T> => {
    await db.query('BEGIN')
    try {
      await db.query(`SET LOCAL ROLE ${role}`)
      if (org) await db.query(`SELECT set_config('app.current_org_id', $1, true)`, [org])
      return await fn()
    } finally { await db.query('ROLLBACK') }
  }
  const insert = (org: string, version: number, kind = 'replaced', text = 'old text') =>
    db.query(
      `INSERT INTO shared_clause_versions (organization_id, clause_id, version, change_kind, clause_title, clause_text, clause_type, sharing_level, text_sha256, recorded_by)
       VALUES ($1, $2, $3, $4, 'Title', $5, 'wages', 'private', $6, 'u1')`,
      [org, clause, version, kind, text, sha(text)],
    )

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL_ })
    await admin.connect()
    const helper = (await admin.query(`SELECT pg_get_functiondef('ue_create_direct_org_rls_policy(text,text,boolean)'::regprocedure) AS d`)).rows[0].d
    await admin.query(`CREATE ROLE ${owner} NOLOGIN`)
    await admin.query(`CREATE DATABASE ${scratch} OWNER ${owner}`)
    db = new pg.Client({ connectionString: withDb(URL_ as string, scratch) })
    await db.connect()
    await db.query(`GRANT ALL ON SCHEMA public TO ${owner}`)
    await migrate(helper)
    await migrate(`CREATE TABLE organizations (id uuid PRIMARY KEY); INSERT INTO organizations VALUES ('${orgA}'), ('${orgB}');`)
    await migrate(P())
    await migrate(P())
    await db.query(`GRANT SELECT, INSERT ON shared_clause_versions TO union_eyes_runtime; GRANT SELECT ON shared_clause_versions TO union_eyes_system`)
    await migrate(C())
    await migrate(C())
  })
  afterAll(async () => {
    await db?.end()
    await admin?.query(`DROP DATABASE IF EXISTS ${scratch} WITH (FORCE)`)
    await admin?.query(`DROP ROLE IF EXISTS ${owner}`)
    await admin?.end()
  })

  it('leaves exactly select, insert and a system select policy, with row security forced', async () => {
    const names = (await db.query(`SELECT policyname FROM pg_policies WHERE tablename = 'shared_clause_versions' ORDER BY 1`)).rows.map((r) => r.policyname)
    expect(names).toEqual(['ue_org_isolation_insert', 'ue_org_isolation_select', 'ue_system_select'])
    expect((await db.query(`SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid = 'shared_clause_versions'::regclass`)).rows[0]).toEqual({ relrowsecurity: true, relforcerowsecurity: true })
  })

  it('lets an organization record and read its own versions, and nobody else\'s', async () => {
    // committed through the runtime role itself: under FORCE ROW LEVEL SECURITY not even the table owner may insert
    await db.query('BEGIN')
    await db.query(`SET LOCAL ROLE union_eyes_runtime`)
    await db.query(`SELECT set_config('app.current_org_id', $1, true)`, [orgA])
    await insert(orgA, 1)
    await db.query('COMMIT')
    expect(await as('union_eyes_runtime', orgA, async () => (await db.query(`SELECT version FROM shared_clause_versions`)).rowCount)).toBe(1)
    expect(await as('union_eyes_runtime', orgB, async () => (await db.query(`SELECT 1 FROM shared_clause_versions`)).rowCount)).toBe(0)
    expect(await as('union_eyes_runtime', undefined, async () => (await db.query(`SELECT 1 FROM shared_clause_versions`)).rowCount)).toBe(0)
    expect(await as('union_eyes_system', undefined, async () => (await db.query(`SELECT 1 FROM shared_clause_versions`)).rowCount)).toBe(1)
  })

  it('refuses another organization\'s insert, any update or delete, and a system insert', async () => {
    await expect(as('union_eyes_runtime', orgA, () => insert(orgB, 9))).rejects.toThrow(/row-level security/)
    await expect(as('union_eyes_runtime', orgA, () => db.query(`UPDATE shared_clause_versions SET clause_text = 'x'`))).rejects.toThrow(/permission denied/)
    await expect(as('union_eyes_runtime', orgA, () => db.query(`DELETE FROM shared_clause_versions`))).rejects.toThrow(/permission denied/)
    await expect(as('union_eyes_system', undefined, () => insert(orgA, 10))).rejects.toThrow(/permission denied/)
  })

  it('records a version once, refuses a bad kind or digest, and keeps the history without the clause', async () => {
    await expect(as('union_eyes_runtime', orgA, async () => { await insert(orgA, 1); })).rejects.toThrow(/shared_clause_versions_unique/)
    await expect(as('union_eyes_runtime', orgA, () => insert(orgA, 2, 'edited'))).rejects.toThrow(/shared_clause_versions_kind_check/)
    await expect(as('union_eyes_runtime', orgA, () => db.query(`INSERT INTO shared_clause_versions (organization_id, clause_id, version, change_kind, clause_title, clause_text, clause_type, sharing_level, text_sha256, recorded_by) VALUES ($1, $2, 3, 'deleted', 't', 'x', 'w', 'private', 'nothex', 'u')`, [orgA, randomUUID()]))).rejects.toThrow(/shared_clause_versions_sha_check/)
    // no foreign key to a clause table: the clause id above never existed in any table here and the row is still readable
    expect(await as('union_eyes_runtime', orgA, async () => (await db.query(`SELECT 1 FROM shared_clause_versions WHERE clause_id = $1`, [clause])).rowCount)).toBe(1)
  })

  it('rolls back both migrations and re-applies them', async () => {
    await migrate(C(true))
    expect((await db.query(`SELECT count(*)::int AS n FROM pg_policies WHERE tablename = 'shared_clause_versions'`)).rows[0].n).toBe(0)
    await migrate(P(true))
    expect((await db.query(`SELECT to_regclass('public.shared_clause_versions') AS t`)).rows[0].t).toBeNull()
    await migrate(P())
    expect((await db.query(`SELECT to_regclass('public.shared_clause_versions') AS t`)).rows[0].t).not.toBeNull()
  })
})

/**
 * Native PostgreSQL qualification of cache migration 0034_remaining_principal_columns_text (R-29).
 *
 * Part one, on a disposable database holding the PRECEDING shape (six uuid principal columns, with the organization isolation
 * policy the real tables carry, and cookie_consents whose user_id is a foreign key that must NOT change): the migration is
 * applied and proven to preserve rows and policies, to accept text principals, to leave the foreign key and its column alone,
 * to be idempotent, to fail closed without its tables, and its rollback is proven to refuse when it would lose history. Part
 * two checks the combined database built by Django migrate plus the approved Drizzle bootstrap, which applied it for real.
 *
 * Needs UE_AUTHORITY_COMBINED_URL (see apps/union-eyes/db/__tests__/README.md); skipped when it is not set.
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const URL_ = process.env.UE_AUTHORITY_COMBINED_URL
const dir = join(__dirname, '..', 'migrations-cache')
const up = readFileSync(join(dir, '0034_remaining_principal_columns_text.sql'), 'utf8')
const down = readFileSync(join(dir, '0034_remaining_principal_columns_text.rollback.sql'), 'utf8')

const COLUMNS: Array<[string, string]> = [
  ['employer_communications', 'sender_user_id'],
  ['employer_communications', 'created_by'],
  ['employer_contacts', 'created_by'],
  ['ai_grievance_triages', 'reviewed_by'],
  ['ai_clause_reasonings', 'reviewed_by'],
  ['ai_copilot_sessions', 'user_id'],
]

const PRECEDING = `
  CREATE TABLE public.profiles (id uuid PRIMARY KEY);
  CREATE TABLE public.employer_communications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, sender_user_id uuid, created_by uuid);
  CREATE TABLE public.employer_contacts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, created_by uuid);
  CREATE TABLE public.ai_grievance_triages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, reviewed_by uuid);
  CREATE TABLE public.ai_clause_reasonings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, reviewed_by uuid);
  CREATE TABLE public.ai_copilot_sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, user_id uuid NOT NULL);
  CREATE TABLE public.cookie_consents (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, user_id uuid REFERENCES public.profiles(id));
  CREATE INDEX idx_ai_copilot_sessions_user ON public.ai_copilot_sessions (user_id);
  ALTER TABLE public.ai_copilot_sessions ENABLE ROW LEVEL SECURITY;
  CREATE POLICY ue_org_isolation_select ON public.ai_copilot_sessions FOR SELECT USING (organization_id::text = current_setting('app.current_org_id', true));
`

const withDb = (url: string, name: string) => {
  const u = new globalThis.URL(url)
  u.pathname = `/${name}`
  return u.toString()
}
const typeOf = async (c: pg.Client, table: string, column: string) =>
  (await c.query(`SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2`, [table, column])).rows[0]?.data_type as string | undefined

describe.skipIf(!URL_)('migration 0034 on native PostgreSQL', () => {
  const scratch = `m0034_${randomUUID().replace(/-/g, '').slice(0, 12)}`
  const org = randomUUID()
  const legacyUser = randomUUID()
  let admin: pg.Client
  let db: pg.Client
  const types = async () => Promise.all(COLUMNS.map(([t, c]) => typeOf(db, t, c)))

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL_ })
    await admin.connect()
    await admin.query(`CREATE DATABASE ${scratch}`)
    db = new pg.Client({ connectionString: withDb(URL_ as string, scratch) })
    await db.connect()
    await db.query(PRECEDING)
  })

  afterAll(async () => {
    await db?.end()
    await admin?.query(`DROP DATABASE IF EXISTS ${scratch} WITH (FORCE)`)
    await admin?.end()
  })

  it('upgrades the preceding shape: six columns become text; existing uuid values, the index and the policy survive', async () => {
    await db.query(`INSERT INTO employer_communications (organization_id, sender_user_id, created_by) VALUES ($1, $2, $2)`, [org, legacyUser])
    await db.query(`INSERT INTO ai_copilot_sessions (organization_id, user_id) VALUES ($1, $2)`, [org, legacyUser])
    expect(await types()).toEqual(Array(6).fill('uuid'))
    await db.query(up)
    expect(await types()).toEqual(Array(6).fill('text'))
    expect((await db.query(`SELECT sender_user_id, created_by FROM employer_communications`)).rows[0]).toEqual({ sender_user_id: legacyUser, created_by: legacyUser })
    expect((await db.query(`SELECT 1 FROM pg_indexes WHERE indexname='idx_ai_copilot_sessions_user'`)).rowCount).toBe(1)
    expect((await db.query(`SELECT 1 FROM pg_policies WHERE tablename='ai_copilot_sessions' AND policyname='ue_org_isolation_select'`)).rowCount).toBe(1)
  })

  it('accepts a text principal in every changed column', async () => {
    await db.query(`INSERT INTO employer_communications (organization_id, sender_user_id, created_by) VALUES ($1, 'ue-qa-staff-primary', 'ue-qa-admin-primary')`, [org])
    await db.query(`INSERT INTO employer_contacts (organization_id, created_by) VALUES ($1, 'ue-qa-admin-primary')`, [org])
    await db.query(`INSERT INTO ai_grievance_triages (organization_id, reviewed_by) VALUES ($1, 'ue-qa-steward-primary')`, [org])
    await db.query(`INSERT INTO ai_clause_reasonings (organization_id, reviewed_by) VALUES ($1, 'ue-qa-steward-primary')`, [org])
    await db.query(`INSERT INTO ai_copilot_sessions (organization_id, user_id) VALUES ($1, 'ue-qa-steward-primary')`, [org])
  })

  it('leaves cookie_consents.user_id and its foreign key to profiles untouched', async () => {
    expect(await typeOf(db, 'cookie_consents', 'user_id')).toBe('uuid')
    expect((await db.query(`SELECT count(*)::int AS n FROM pg_constraint WHERE conrelid='public.cookie_consents'::regclass AND contype='f'`)).rows[0].n).toBe(1)
    await expect(db.query(`INSERT INTO cookie_consents (organization_id, user_id) VALUES ($1, $2)`, [org, randomUUID()])).rejects.toThrow(/foreign key|violates/)
  })

  it('is idempotent', async () => {
    await db.query(up)
    await db.query(up)
    expect(await types()).toEqual(Array(6).fill('text'))
    expect((await db.query(`SELECT count(*)::int AS n FROM employer_communications`)).rows[0].n).toBe(2)
  })

  it('rolls back only when no history would be lost', async () => {
    await expect(db.query(down)).rejects.toThrow(/rollback refused/)
    expect(await types()).toEqual(Array(6).fill('text'))
    await db.query(`DELETE FROM employer_communications WHERE sender_user_id = 'ue-qa-staff-primary'`)
    await db.query(`DELETE FROM employer_contacts WHERE created_by = 'ue-qa-admin-primary'`)
    await db.query(`DELETE FROM ai_grievance_triages WHERE reviewed_by = 'ue-qa-steward-primary'`)
    await db.query(`DELETE FROM ai_clause_reasonings WHERE reviewed_by = 'ue-qa-steward-primary'`)
    await db.query(`DELETE FROM ai_copilot_sessions WHERE user_id = 'ue-qa-steward-primary'`)
    await db.query(down)
    expect(await types()).toEqual(Array(6).fill('uuid'))
    await db.query(up)
    expect(await types()).toEqual(Array(6).fill('text'))
  })

  it('fails closed when a table does not exist', async () => {
    await db.query('ALTER TABLE public.ai_clause_reasonings RENAME TO ai_clause_reasonings_moved')
    await expect(db.query(up)).rejects.toThrow(/fail-closed/)
    await db.query('ALTER TABLE public.ai_clause_reasonings_moved RENAME TO ai_clause_reasonings')
  })

  it('holds on the combined database: six text columns, cookie_consents.user_id still uuid with its foreign key', async () => {
    const combined = new pg.Client({ connectionString: URL_ })
    await combined.connect()
    try {
      for (const [table, column] of COLUMNS) expect(await typeOf(combined, table, column), `${table}.${column}`).toBe('text')
      expect(await typeOf(combined, 'cookie_consents', 'user_id')).toBe('uuid')
      expect((await combined.query(`SELECT count(*)::int AS n FROM pg_constraint WHERE conrelid='public.cookie_consents'::regclass AND contype='f' AND pg_get_constraintdef(oid) ~ 'user_id'`)).rows[0].n).toBe(1)
    } finally {
      await combined.end()
    }
  })
})

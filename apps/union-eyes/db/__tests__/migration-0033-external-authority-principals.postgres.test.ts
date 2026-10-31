/**
 * Native PostgreSQL qualification of cache migration 0033_external_authority_principals_text (R-29).
 *
 * Part one, on a disposable database holding the PRECEDING shape (nine uuid principal columns across the three external
 * representation tables, with the four 0006 policies that name them): the migration is applied, and proven to preserve rows,
 * to accept text principals, to keep the row-level policies working for the runtime role, to be idempotent, to fail closed
 * without its tables, and its rollback is proven to refuse when it would lose history. Part two checks the combined database
 * built by Django migrate plus the approved Drizzle bootstrap, which applied it for real.
 *
 * Needs UE_AUTHORITY_COMBINED_URL (see apps/union-eyes/db/__tests__/README.md); skipped when it is not set. The disposable
 * database is created and dropped on the same server and never touches the combined database's data.
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const URL_ = process.env.UE_AUTHORITY_COMBINED_URL
const dir = join(__dirname, '..', 'migrations-cache')
const up = readFileSync(join(dir, '0033_external_authority_principals_text.sql'), 'utf8')
const down = readFileSync(join(dir, '0033_external_authority_principals_text.rollback.sql'), 'utf8')

const COLUMNS: Array<[string, string]> = [
  ['representation_authorities', 'representative_user_id'],
  ['representation_authorities', 'revoked_by'],
  ['representation_authorities', 'created_by'],
  ['external_matter_access_grants', 'user_id'],
  ['external_matter_access_grants', 'revoked_by'],
  ['external_matter_access_grants', 'granted_by'],
  ['external_document_access_grants', 'user_id'],
  ['external_document_access_grants', 'revoked_by'],
  ['external_document_access_grants', 'granted_by'],
]
const POLICIES = ['ue_external_authorities_select', 'ue_external_matter_grants_select', 'ue_external_document_grants_select', 'ue_external_document_grants_insert_self']

const PRECEDING = `
  CREATE TABLE public.representation_authorities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL,
    representative_user_id uuid NOT NULL, revoked_by uuid, created_by uuid NOT NULL
  );
  CREATE TABLE public.external_matter_access_grants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL,
    user_id uuid NOT NULL, revoked_by uuid, granted_by uuid NOT NULL
  );
  CREATE TABLE public.external_document_access_grants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL,
    user_id uuid NOT NULL, revoked_by uuid, granted_by uuid NOT NULL
  );
  CREATE INDEX idx_external_matter_grants_user ON public.external_matter_access_grants (user_id);
  ALTER TABLE public.representation_authorities ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.representation_authorities FORCE ROW LEVEL SECURITY;
  ALTER TABLE public.external_matter_access_grants ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.external_matter_access_grants FORCE ROW LEVEL SECURITY;
  ALTER TABLE public.external_document_access_grants ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.external_document_access_grants FORCE ROW LEVEL SECURITY;
  CREATE POLICY ue_external_authorities_select ON public.representation_authorities FOR SELECT TO union_eyes_runtime
    USING (organization_id::text = current_setting('app.current_org_id', true) AND representative_user_id::text = current_setting('app.current_user_id', true));
  CREATE POLICY ue_external_matter_grants_select ON public.external_matter_access_grants FOR SELECT TO union_eyes_runtime
    USING (organization_id::text = current_setting('app.current_org_id', true) AND user_id::text = current_setting('app.current_user_id', true));
  CREATE POLICY ue_external_document_grants_select ON public.external_document_access_grants FOR SELECT TO union_eyes_runtime
    USING (organization_id::text = current_setting('app.current_org_id', true) AND user_id::text = current_setting('app.current_user_id', true));
  CREATE POLICY ue_external_document_grants_insert_self ON public.external_document_access_grants FOR INSERT TO union_eyes_runtime
    WITH CHECK (organization_id::text = current_setting('app.current_org_id', true) AND user_id::text = current_setting('app.current_user_id', true) AND granted_by::text = current_setting('app.current_user_id', true));
  GRANT SELECT, INSERT ON public.representation_authorities, public.external_matter_access_grants, public.external_document_access_grants TO union_eyes_runtime;
`

const withDb = (url: string, name: string) => {
  const u = new globalThis.URL(url)
  u.pathname = `/${name}`
  return u.toString()
}

const typeOf = async (c: pg.Client, table: string, column: string) =>
  (await c.query(`SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2`, [table, column])).rows[0]?.data_type as string | undefined

describe.skipIf(!URL_)('migration 0033 on native PostgreSQL', () => {
  const scratch = `m0033_${randomUUID().replace(/-/g, '').slice(0, 12)}`
  const org = randomUUID()
  const legacyUser = randomUUID()
  let admin: pg.Client
  let db: pg.Client
  const types = async () => Promise.all(COLUMNS.map(([t, c]) => typeOf(db, t, c)))
  const policyNames = async () => (await db.query(`SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename IN ('representation_authorities','external_matter_access_grants','external_document_access_grants') AND policyname = ANY($1) ORDER BY policyname`, [POLICIES])).rows.map((r) => r.policyname as string)

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

  it('upgrades the preceding shape: nine columns become text, existing uuid values and the index survive, all four policies are back', async () => {
    await db.query(`INSERT INTO representation_authorities (organization_id, representative_user_id, created_by) VALUES ($1, $2, $2)`, [org, legacyUser])
    await db.query(`INSERT INTO external_matter_access_grants (organization_id, user_id, granted_by) VALUES ($1, $2, $2)`, [org, legacyUser])
    await db.query(`INSERT INTO external_document_access_grants (organization_id, user_id, granted_by) VALUES ($1, $2, $2)`, [org, legacyUser])
    expect(await types()).toEqual(Array(9).fill('uuid'))
    await db.query(up)
    expect(await types()).toEqual(Array(9).fill('text'))
    expect((await db.query(`SELECT representative_user_id, created_by FROM representation_authorities`)).rows[0]).toEqual({ representative_user_id: legacyUser, created_by: legacyUser })
    expect((await db.query(`SELECT 1 FROM pg_indexes WHERE indexname='idx_external_matter_grants_user'`)).rowCount).toBe(1)
    expect(await policyNames()).toEqual([...POLICIES].sort())
  })

  it('accepts a text principal in every table (the failure the external journey hits)', async () => {
    await db.query(`INSERT INTO representation_authorities (organization_id, representative_user_id, created_by) VALUES ($1, 'ue-qa-external-counsel', 'ue-qa-admin-primary')`, [org])
    await db.query(`INSERT INTO external_matter_access_grants (organization_id, user_id, granted_by) VALUES ($1, 'ue-qa-external-counsel', 'ue-qa-admin-primary')`, [org])
    await db.query(`INSERT INTO external_document_access_grants (organization_id, user_id, granted_by) VALUES ($1, 'ue-qa-external-counsel', 'ue-qa-admin-primary')`, [org])
  })

  it('keeps the row-level policies working for the runtime role: a principal sees only its own rows, in its own organization', async () => {
    const visible = async (user: string, organization: string) => {
      await db.query('BEGIN')
      try {
        await db.query('SET LOCAL ROLE union_eyes_runtime')
        await db.query(`SELECT set_config('app.current_org_id', $1, true), set_config('app.current_user_id', $2, true)`, [organization, user])
        return (await db.query(`SELECT count(*)::int AS n FROM external_matter_access_grants`)).rows[0].n as number
      } finally {
        await db.query('ROLLBACK')
      }
    }
    expect(await visible('ue-qa-external-counsel', org)).toBe(1)
    expect(await visible(legacyUser, org)).toBe(1)
    expect(await visible('ue-qa-someone-else', org)).toBe(0)
    expect(await visible('ue-qa-external-counsel', randomUUID())).toBe(0)
  })

  it('is idempotent', async () => {
    await db.query(up)
    await db.query(up)
    expect(await types()).toEqual(Array(9).fill('text'))
    expect(await policyNames()).toEqual([...POLICIES].sort())
    expect((await db.query(`SELECT count(*)::int AS n FROM representation_authorities`)).rows[0].n).toBe(2)
  })

  it('rolls back only when no history would be lost', async () => {
    await expect(db.query(down)).rejects.toThrow(/rollback refused/)
    expect(await types()).toEqual(Array(9).fill('text'))
    for (const [table] of [...new Set(COLUMNS.map((c) => c[0]))].map((t) => [t])) {
      await db.query(`DELETE FROM public.${table} WHERE organization_id = $1 AND ${table === 'representation_authorities' ? 'representative_user_id' : 'user_id'} = 'ue-qa-external-counsel'`, [org])
    }
    await db.query(down)
    expect(await types()).toEqual(Array(9).fill('uuid'))
    expect(await policyNames()).toEqual([...POLICIES].sort())
    await db.query(up)
    expect(await types()).toEqual(Array(9).fill('text'))
  })

  it('fails closed when a table does not exist', async () => {
    await db.query('ALTER TABLE public.external_document_access_grants RENAME TO external_document_access_grants_moved')
    await expect(db.query(up)).rejects.toThrow(/fail-closed/)
    await db.query('ALTER TABLE public.external_document_access_grants_moved RENAME TO external_document_access_grants')
  })

  it('holds on the combined database: nine text columns, four policies, the runtime role keeps its privileges', async () => {
    const combined = new pg.Client({ connectionString: URL_ })
    await combined.connect()
    try {
      for (const [table, column] of COLUMNS) expect(await typeOf(combined, table, column), `${table}.${column}`).toBe('text')
      const policies = (await combined.query(`SELECT policyname FROM pg_policies WHERE schemaname='public' AND policyname = ANY($1)`, [POLICIES])).rows.map((r) => r.policyname)
      expect(policies.sort()).toEqual([...POLICIES].sort())
      const grants = (await combined.query(`SELECT has_table_privilege('union_eyes_runtime','public.representation_authorities','SELECT') AS a, has_table_privilege('union_eyes_runtime','public.external_matter_access_grants','SELECT') AS m, has_table_privilege('union_eyes_runtime','public.external_document_access_grants','INSERT') AS d`)).rows[0]
      expect(grants).toEqual({ a: true, m: true, d: true })
    } finally {
      await combined.end()
    }
  })
})

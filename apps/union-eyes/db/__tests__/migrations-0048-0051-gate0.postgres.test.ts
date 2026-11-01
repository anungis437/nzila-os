/**
 * Native PostgreSQL qualification of the Gate 0 platform migrations 0048-0051 and their cache (row security) closures 0038-0041:
 * the SCIM bearer-token shape, the claim status-change history that starts the SLA clock, survey anonymity, and the arbitration
 * decision owner.
 *
 * Each part runs on a disposable database that holds the PRECEDING shape (the minimal Django stubs the combined bootstrap creates),
 * owned by a non-superuser role so FORCE ROW LEVEL SECURITY applies to the SECURITY DEFINER trigger functions exactly as it does
 * for the migration role in a deployment. The migrations are applied, applied again (idempotency), fail closed on what they cannot
 * safely rewrite, and are rolled back. Behaviour is then proven AS union_eyes_runtime and union_eyes_system, never as the superuser,
 * with the grants the storage-authority manifest names for each table.
 *
 * Needs UE_AUTHORITY_COMBINED_URL (see apps/union-eyes/db/__tests__/README.md); skipped when it is not set. Disposable databases are
 * created and dropped on the same server and never touch the combined database's data; ue_create_direct_org_rls_policy is copied
 * from it, so the cache migrations run against the real helper, not a stand-in.
 */
import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const URL_ = process.env.UE_AUTHORITY_COMBINED_URL
const platform = (name: string, rollback = false) => readFileSync(join(__dirname, '..', 'migrations-platform', `${name}${rollback ? '.rollback' : ''}.sql`), 'utf8')
const cache = (name: string, rollback = false) => readFileSync(join(__dirname, '..', 'migrations-cache', `${name}${rollback ? '.rollback' : ''}.sql`), 'utf8')

const M0048 = '0048_sso_scim_shape'
const M0049 = '0049_claim_status_transitions'
const M0050 = '0050_survey_anonymity'
const M0051 = '0051_arbitration_decision_owner'
const C0038 = '0038_scim_configurations_rls_closure'
const C0039 = '0039_claim_status_transitions_rls_closure'
const C0040 = '0040_satisfaction_survey_responded_rls_closure'
const C0041 = '0041_arbitration_decisions_owner_rls'

const withDb = (url: string, name: string) => {
  const u = new globalThis.URL(url)
  u.pathname = `/${name}`
  return u.toString()
}
const tag = () => randomUUID().replace(/-/g, '').slice(0, 10)

const sha256hex = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')

describe.skipIf(!URL_)('Gate 0 migrations 0048-0051 and 0038-0041 on native PostgreSQL', () => {
  const scratch = `g0mig_${tag()}`
  const owner = `g0_owner_${tag()}`
  const orgA = randomUUID()
  const orgB = randomUUID()
  let admin: pg.Client
  let db: pg.Client
  let helperDef = ''

  /** Run `fn` as an application role under a tenant session; the transaction is rolled back. */
  const as = async <T>(role: 'union_eyes_runtime' | 'union_eyes_system', org: string | undefined, fn: () => Promise<T>): Promise<T> => {
    await db.query('BEGIN')
    try {
      await db.query(`SET LOCAL ROLE ${role}`)
      if (org !== undefined) await db.query(`SELECT set_config('app.current_org_id', $1, true)`, [org])
      return await fn()
    } finally {
      await db.query('ROLLBACK')
    }
  }

  /** Apply SQL as the table-owning migration role (not a superuser, so FORCE RLS applies to it). */
  const migrate = async (sql: string) => {
    await db.query(`SET ROLE ${owner}`)
    try {
      await db.query(sql)
    } finally {
      await db.query('RESET ROLE')
    }
  }

  const columns = async (table: string) =>
    (await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`, [table])).rows.map((r) => r.column_name as string)
  const exists = async (table: string) => (await db.query(`SELECT to_regclass($1) AS t`, [`public.${table}`])).rows[0].t !== null
  const policyNames = async (table: string) =>
    (await db.query(`SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=$1 ORDER BY policyname`, [table])).rows.map((r) => r.policyname as string)
  const rejects = async (fn: () => Promise<unknown>, pattern: RegExp) => {
    await expect(fn()).rejects.toThrow(pattern)
  }

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL_ })
    await admin.connect()
    helperDef = (await admin.query(`SELECT pg_get_functiondef('ue_create_direct_org_rls_policy(text,text,boolean)'::regprocedure) AS d`)).rows[0].d
    await admin.query(`CREATE ROLE ${owner} NOLOGIN`)
    await admin.query(`CREATE DATABASE ${scratch} OWNER ${owner}`)
    db = new pg.Client({ connectionString: withDb(URL_ as string, scratch) })
    await db.connect()
    await db.query(`GRANT ALL ON SCHEMA public TO ${owner}`)
    await migrate(helperDef)
    // The preceding shapes: minimal Django stubs, as the combined bootstrap creates them.
    await migrate(`
      CREATE TABLE organizations (id uuid PRIMARY KEY);
      INSERT INTO organizations VALUES ('${orgA}'), ('${orgB}');
      CREATE TABLE claims (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid, status varchar(50) NOT NULL DEFAULT 'submitted', updated_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE satisfaction_surveys (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, claim_id uuid NOT NULL, member_id varchar(255) NOT NULL,
        is_anonymous boolean NOT NULL DEFAULT false, status varchar(50) NOT NULL DEFAULT 'pending', sent_at timestamptz, metadata jsonb DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(), feedback text);
      CREATE TABLE sso_providers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL);
      CREATE TABLE scim_configurations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
      CREATE TABLE arbitration_decisions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), case_number varchar(100) NOT NULL, is_public boolean DEFAULT true, access_restrictions text, imported_from varchar(200));
    `)
  })

  afterAll(async () => {
    await db?.end()
    await admin?.query(`DROP DATABASE IF EXISTS ${scratch} WITH (FORCE)`)
    await admin?.query(`DROP ROLE IF EXISTS ${owner}`)
    await admin?.end()
  })

  describe('0048 + 0038: SCIM configuration', () => {
    it('fails closed, rewriting nothing, on a populated stub that lacks the required columns', async () => {
      await db.query(`INSERT INTO scim_configurations (organization_id) VALUES ('${orgA}')`)
      await rejects(() => migrate(platform(M0048)), /fail-closed: public\.scim_configurations holds 1 row/)
      expect(await columns('scim_configurations')).not.toContain('token_hash')
      await db.query('DELETE FROM scim_configurations')
    })

    it('widens the stubs, keeps no plaintext token column, and is idempotent', async () => {
      await migrate(platform(M0048))
      await migrate(platform(M0048))
      const cols = await columns('scim_configurations')
      expect(cols).toEqual(expect.arrayContaining(['token_hash', 'token_expires_at', 'token_last_used_at', 'revoked_at', 'base_url', 'enabled']))
      expect(cols).not.toContain('bearer_token')
      expect(await columns('sso_providers')).toEqual(expect.arrayContaining(['provider_type', 'attribute_mapping', 'enabled', 'oidc_client_secret']))
    })

    it('creates a configuration disabled, refuses a malformed or duplicate hash and a second configuration per organization', async () => {
      const insert = (org: string, hash: string | null) =>
        db.query(`INSERT INTO scim_configurations (organization_id, base_url, user_attribute_mapping, created_by, token_hash) VALUES ($1, '/scim', '{}'::jsonb, 'qa', $2) RETURNING enabled`, [org, hash])
      const good = sha256hex('scim_example-token-value')
      expect((await insert(orgA, good)).rows[0].enabled).toBe(false)
      await rejects(() => insert(orgB, 'not-a-sha256'), /scim_configurations_token_hash_check/)
      await rejects(() => insert(orgB, good), /scim_configurations_token_hash_uq/)
      await rejects(() => insert(orgA, null), /scim_configurations_organization_uq/)
      await db.query('DELETE FROM scim_configurations')
    })

    it('hashes a legacy plaintext bearer_token into token_hash and drops the column', async () => {
      const legacy = `g0leg_${tag()}`
      await admin.query(`CREATE DATABASE ${legacy} OWNER ${owner}`)
      const c = new pg.Client({ connectionString: withDb(URL_ as string, legacy) })
      await c.connect()
      try {
        await c.query(`GRANT ALL ON SCHEMA public TO ${owner}`)
        await c.query(`SET ROLE ${owner}`)
        await c.query(`
          CREATE TABLE sso_providers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL);
          CREATE TABLE scim_configurations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, base_url varchar(500) NOT NULL, bearer_token text,
            user_attribute_mapping jsonb NOT NULL, created_by varchar(255) NOT NULL);
          INSERT INTO scim_configurations (organization_id, base_url, bearer_token, user_attribute_mapping, created_by) VALUES ('${orgA}', '/scim', 'legacy-plain-token', '{}'::jsonb, 'qa');
        `)
        await c.query(platform(M0048))
        const row = (await c.query(`SELECT token_hash FROM scim_configurations`)).rows[0]
        expect(row.token_hash).toBe(sha256hex('legacy-plain-token'))
        const cols = (await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='scim_configurations'`)).rows.map((r) => r.column_name)
        expect(cols).not.toContain('bearer_token')
      } finally {
        await c.end()
        await admin.query(`DROP DATABASE IF EXISTS ${legacy} WITH (FORCE)`)
      }
    })

    it('0038 forces row security: a tenant sees and changes only its own configuration; the system role finds one by hash', async () => {
      await db.query(`GRANT SELECT, INSERT, UPDATE ON scim_configurations TO union_eyes_runtime; GRANT SELECT, UPDATE ON scim_configurations TO union_eyes_system`)
      await migrate(cache(C0038))
      await migrate(cache(C0038))
      expect(await policyNames('scim_configurations')).toEqual(['ue_org_isolation_delete', 'ue_org_isolation_insert', 'ue_org_isolation_select', 'ue_org_isolation_update', 'ue_system_full_access'])
      const hashA = sha256hex('scim_a')
      await db.query(`INSERT INTO scim_configurations (organization_id, base_url, user_attribute_mapping, created_by, token_hash, enabled) VALUES ($1, '/a', '{}'::jsonb, 'qa', $2, true), ($3, '/b', '{}'::jsonb, 'qa', $4, true)`, [orgA, hashA, orgB, sha256hex('scim_b')])

      expect(await as('union_eyes_runtime', orgA, async () => (await db.query(`SELECT base_url FROM scim_configurations`)).rows)).toEqual([{ base_url: '/a' }])
      expect(await as('union_eyes_runtime', undefined, async () => (await db.query(`SELECT 1 FROM scim_configurations`)).rowCount)).toBe(0)
      expect(await as('union_eyes_runtime', 'not-a-uuid', async () => (await db.query(`SELECT 1 FROM scim_configurations`)).rowCount)).toBe(0)
      expect(await as('union_eyes_runtime', orgA, async () => (await db.query(`UPDATE scim_configurations SET enabled = false WHERE organization_id = $1`, [orgB])).rowCount)).toBe(0)
      await rejects(
        () => as('union_eyes_runtime', orgA, () => db.query(`INSERT INTO scim_configurations (organization_id, base_url, user_attribute_mapping, created_by) VALUES ($1, '/x', '{}'::jsonb, 'qa')`, [orgB])),
        /row-level security/,
      )
      await rejects(() => as('union_eyes_runtime', orgA, () => db.query(`DELETE FROM scim_configurations`)), /permission denied/)

      // The IdP is authenticated before any tenant is known: the system role finds the configuration by its hash, and only that one.
      const found = await as('union_eyes_system', undefined, async () => (await db.query(`SELECT organization_id FROM scim_configurations WHERE token_hash = $1`, [hashA])).rows)
      expect(found).toEqual([{ organization_id: orgA }])
    })

    it('rolls back 0038 (policies and row security) and 0048 (the columns)', async () => {
      await migrate(cache(C0038, true))
      expect(await policyNames('scim_configurations')).toEqual([])
      expect((await db.query(`SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid = 'scim_configurations'::regclass`)).rows[0]).toEqual({ relrowsecurity: false, relforcerowsecurity: false })
      await db.query('DELETE FROM scim_configurations')
      await migrate(platform(M0048, true))
      expect(await columns('scim_configurations')).not.toContain('token_hash')
      await migrate(platform(M0048))
      expect(await columns('scim_configurations')).toContain('token_hash')
    })
  })

  describe('0049 + 0039: claim status clock and history', () => {
    const claim = async (status = 'submitted', org: string | null = orgA) =>
      (await db.query(`INSERT INTO claims (organization_id, status) VALUES ($1, $2) RETURNING id, status_changed_at`, [org, status])).rows[0] as { id: string; status_changed_at: Date | null }

    it('leaves existing claims with an unknown status moment: it is not backfilled from updated_at', async () => {
      const before = (await db.query(`INSERT INTO claims (organization_id, status, updated_at) VALUES ($1, 'open', now() - interval '30 days') RETURNING id`, [orgA])).rows[0].id
      await migrate(platform(M0049))
      await migrate(platform(M0049))
      expect((await db.query(`SELECT status_changed_at FROM claims WHERE id = $1`, [before])).rows[0].status_changed_at).toBeNull()
    })

    it('stamps creation and a real status change, and never moves the clock for an edit that leaves the status alone', async () => {
      const created = await claim()
      expect(created.status_changed_at).not.toBeNull()
      // microsecond precision is kept by comparing the text the server returns, not a JavaScript Date
      const stamp = async () => (await db.query(`SELECT status_changed_at::text AS s FROM claims WHERE id = $1`, [created.id])).rows[0].s as string
      const first = await stamp()
      await db.query(`UPDATE claims SET status_changed_at = now() - interval '10 days' WHERE id = $1`, [created.id])
      expect(await stamp()).toBe(first)
      await db.query(`UPDATE claims SET updated_at = now() + interval '1 day' WHERE id = $1`, [created.id])
      expect(await stamp()).toBe(first)
      await db.query(`SELECT pg_sleep(0.01)`)
      await db.query(`UPDATE claims SET status = 'investigation' WHERE id = $1`, [created.id])
      expect((await db.query(`SELECT status_changed_at > $2::timestamptz AS moved FROM claims WHERE id = $1`, [created.id, first])).rows[0].moved).toBe(true)
    })

    it('records each status change, but not an unchanged status, and none for a claim with no organization', async () => {
      const c = await claim('submitted')
      await db.query(`UPDATE claims SET status = 'under_review' WHERE id = $1`, [c.id])
      await db.query(`UPDATE claims SET status = 'under_review', updated_at = now() WHERE id = $1`, [c.id])
      await db.query(`UPDATE claims SET status = 'closed' WHERE id = $1`, [c.id])
      const rows = (await db.query(`SELECT from_status, to_status FROM claim_status_transitions WHERE claim_id = $1 ORDER BY changed_at, to_status`, [c.id])).rows
      expect(rows).toEqual(expect.arrayContaining([{ from_status: null, to_status: 'submitted' }, { from_status: 'submitted', to_status: 'under_review' }, { from_status: 'under_review', to_status: 'closed' }]))
      expect(rows).toHaveLength(3)
      const orphan = await claim('submitted', null)
      expect((await db.query(`SELECT 1 FROM claim_status_transitions WHERE claim_id = $1`, [orphan.id])).rowCount).toBe(0)
    })

    it('0039 makes the history append-only: tenants read only their own rows and no application role can write, change or delete one', async () => {
      await db.query(`GRANT SELECT ON claim_status_transitions TO union_eyes_runtime, union_eyes_system; GRANT SELECT, INSERT, UPDATE ON claims TO union_eyes_runtime`)
      await migrate(cache(C0039))
      await migrate(cache(C0039))
      expect(await policyNames('claim_status_transitions')).toEqual(['ue_org_isolation_select', 'ue_system_select', 'ue_transition_trigger_insert'])
      expect(await as('union_eyes_runtime', orgB, async () => (await db.query(`SELECT 1 FROM claim_status_transitions`)).rowCount)).toBe(0)
      const own = await as('union_eyes_runtime', orgA, async () => (await db.query(`SELECT 1 FROM claim_status_transitions`)).rowCount)
      expect(own).toBeGreaterThan(0)

      const anyClaim = (await db.query(`SELECT id FROM claims WHERE organization_id = $1 LIMIT 1`, [orgA])).rows[0].id
      const forge = `INSERT INTO claim_status_transitions (organization_id, claim_id, to_status) VALUES ('${orgA}', '${anyClaim}', 'forged')`
      await rejects(() => as('union_eyes_runtime', orgA, () => db.query(forge)), /permission denied|row-level security/)
      await rejects(() => as('union_eyes_system', undefined, () => db.query(forge)), /permission denied|row-level security/)
      await rejects(() => as('union_eyes_runtime', orgA, () => db.query(`UPDATE claim_status_transitions SET to_status = 'x'`)), /permission denied/)
      await rejects(() => as('union_eyes_runtime', orgA, () => db.query(`DELETE FROM claim_status_transitions`)), /permission denied/)
    })

    it('still records the transition when a tenant changes the status under row security (the trigger runs as the table owner)', async () => {
      const c = await claim('submitted')
      await db.query('BEGIN')
      try {
        await db.query(`SET LOCAL ROLE union_eyes_runtime`)
        await db.query(`SELECT set_config('app.current_org_id', $1, true)`, [orgA])
        await db.query(`SELECT set_config('app.current_user_id', 'steward-7', true)`)
        await db.query(`UPDATE claims SET status = 'assigned' WHERE id = $1`, [c.id])
        const t = (await db.query(`SELECT from_status, to_status, changed_by FROM claim_status_transitions WHERE claim_id = $1 AND to_status = 'assigned'`, [c.id])).rows
        expect(t).toEqual([{ from_status: 'submitted', to_status: 'assigned', changed_by: 'steward-7' }])
      } finally {
        await db.query('ROLLBACK')
      }
    })

    it('keeps the SECURITY DEFINER trigger function out of the application roles\' reach (the trigger still fires, as above)', async () => {
      const exec = (fn: string, role: string) => db.query(`SELECT has_function_privilege('${role}', '${fn}', 'EXECUTE') AS ok`).then((r) => r.rows[0].ok as boolean)
      for (const role of ['union_eyes_runtime', 'union_eyes_system', 'public']) {
        expect(await exec('public.ue_claims_record_status_transition()', role)).toBe(false)
      }
    })

    it('rolls back both migrations cleanly and re-applies', async () => {
      await migrate(cache(C0039, true))
      await migrate(platform(M0049, true))
      expect(await exists('claim_status_transitions')).toBe(false)
      expect(await columns('claims')).not.toContain('status_changed_at')
      await migrate(platform(M0049))
      await migrate(cache(C0039))
      expect(await exists('claim_status_transitions')).toBe(true)
    })
  })

  describe('0050 + 0040: survey anonymity', () => {
    const survey = async (claimId: string, memberId: string, anonymous: boolean) =>
      (await db.query(
        `INSERT INTO satisfaction_surveys (organization_id, claim_id, member_id, is_anonymous, status, sent_at, metadata, feedback) VALUES ($1, $2, $3, $4, 'pending', now(), '{"ip":"203.0.113.9"}'::jsonb, 'felt heard') RETURNING id`,
        [orgA, claimId, memberId, anonymous],
      )).rows[0].id as string
    const complete = (id: string) => db.query(`UPDATE satisfaction_surveys SET status = 'completed', completed_at = now() WHERE id = $1`, [id])

    beforeAll(async () => {
      // A deployed survey table already has FORCE ROW LEVEL SECURITY with policies for the application roles only, so the migration role
      // (the owner) sees none of its rows: the scrub and the rollback check must still reach every row.
      await db.query(`GRANT SELECT, UPDATE ON satisfaction_surveys TO union_eyes_runtime`)
      await migrate(`ALTER TABLE satisfaction_surveys ENABLE ROW LEVEL SECURITY; ALTER TABLE satisfaction_surveys FORCE ROW LEVEL SECURITY;
        CREATE POLICY qa_rt ON satisfaction_surveys FOR ALL TO union_eyes_runtime USING (organization_id::text = current_setting('app.current_org_id', true));`)
    })

    it('scrubs anonymous completed rows that already exist, and fails closed if one cannot be scrubbed', async () => {
      const [c1, c2] = [randomUUID(), randomUUID()]
      await db.query(`INSERT INTO satisfaction_surveys (organization_id, claim_id, member_id, is_anonymous, status, completed_at) VALUES ($1, $2, 'm-old-anon', true, 'completed', now()), ($1, $3, 'm-old-named', false, 'completed', now())`, [orgA, c1, c2])
      await migrate(platform(M0050))
      await migrate(platform(M0050))
      expect((await db.query(`SELECT relforcerowsecurity FROM pg_class WHERE oid = 'satisfaction_surveys'::regclass`)).rows[0].relforcerowsecurity).toBe(true)
      const anon = (await db.query(`SELECT member_id, claim_id FROM satisfaction_surveys WHERE feedback IS NULL AND is_anonymous`)).rows
      expect(anon).toEqual([{ member_id: null, claim_id: null }])
      expect((await db.query(`SELECT member_id FROM satisfaction_surveys WHERE NOT is_anonymous`)).rows).toEqual([{ member_id: 'm-old-named' }])
      expect((await db.query(`SELECT claim_id, member_id FROM satisfaction_survey_responded`)).rows).toEqual([{ claim_id: c1, member_id: 'm-old-anon' }])
    })

    it('unlinks an anonymous response on completion and keeps only the fact that the member answered', async () => {
      const claimId = randomUUID()
      const id = await survey(claimId, 'm-anon', true)
      await complete(id)
      const row = (await db.query(`SELECT member_id, claim_id, sent_at, metadata, feedback, date_trunc('month', created_at) = created_at AS month_created, date_trunc('month', completed_at) = completed_at AS month_completed FROM satisfaction_surveys WHERE id = $1`, [id])).rows[0]
      expect(row).toMatchObject({ member_id: null, claim_id: null, sent_at: null, metadata: {}, feedback: 'felt heard', month_created: true, month_completed: true })
      expect((await db.query(`SELECT organization_id, member_id FROM satisfaction_survey_responded WHERE claim_id = $1`, [claimId])).rows).toEqual([{ organization_id: orgA, member_id: 'm-anon' }])
    })

    it('leaves a named response linked, and a pending anonymous response linked until it completes', async () => {
      const claimId = randomUUID()
      const named = await survey(claimId, 'm-named', false)
      await complete(named)
      expect((await db.query(`SELECT member_id, claim_id FROM satisfaction_surveys WHERE id = $1`, [named])).rows[0]).toEqual({ member_id: 'm-named', claim_id: claimId })
      const pending = await survey(randomUUID(), 'm-pending', true)
      expect((await db.query(`SELECT member_id FROM satisfaction_surveys WHERE id = $1`, [pending])).rows[0].member_id).toBe('m-pending')
      expect((await db.query(`SELECT 1 FROM satisfaction_survey_responded WHERE member_id IN ('m-named', 'm-pending')`)).rowCount).toBe(0)
    })

    it('refuses an anonymous completed row that still carries a member or a claim, whatever the writer does', async () => {
      await rejects(
        () => db.query(`ALTER TABLE satisfaction_surveys DISABLE TRIGGER ue_satisfaction_anonymize_response`).then(() => db.query(`INSERT INTO satisfaction_surveys (organization_id, claim_id, member_id, is_anonymous, status) VALUES ($1, $2, 'm-x', true, 'completed')`, [orgA, randomUUID()])),
        /satisfaction_surveys_anonymous_unlinked_check/,
      ).finally(() => db.query(`ALTER TABLE satisfaction_surveys ENABLE TRIGGER ue_satisfaction_anonymize_response`))
    })

    it('keeps the SECURITY DEFINER anonymization function out of the application roles\' reach', async () => {
      for (const role of ['union_eyes_runtime', 'union_eyes_system', 'public']) {
        const ok = (await db.query(`SELECT has_function_privilege('${role}', 'public.ue_satisfaction_anonymize_response()', 'EXECUTE') AS ok`)).rows[0].ok
        expect(ok).toBe(false)
      }
    })

    it('does not record the same member twice for a claim', async () => {
      const claimId = randomUUID()
      await complete(await survey(claimId, 'm-twice', true))
      await complete(await survey(claimId, 'm-twice', true))
      expect((await db.query(`SELECT 1 FROM satisfaction_survey_responded WHERE claim_id = $1`, [claimId])).rowCount).toBe(1)
    })

    it('0040 makes the responded record read-only to the application roles and tenant-isolated', async () => {
      await db.query(`GRANT SELECT ON satisfaction_survey_responded TO union_eyes_runtime; GRANT SELECT, UPDATE ON satisfaction_surveys TO union_eyes_runtime`)
      await migrate(cache(C0040))
      await migrate(cache(C0040))
      expect(await as('union_eyes_runtime', orgB, async () => (await db.query(`SELECT 1 FROM satisfaction_survey_responded`)).rowCount)).toBe(0)
      expect(await as('union_eyes_runtime', orgA, async () => (await db.query(`SELECT 1 FROM satisfaction_survey_responded`)).rowCount)).toBeGreaterThan(0)
      const forge = `INSERT INTO satisfaction_survey_responded (organization_id, claim_id, member_id) VALUES ('${orgA}', '${randomUUID()}', 'forged')`
      await rejects(() => as('union_eyes_runtime', orgA, () => db.query(forge)), /permission denied|row-level security/)
      await rejects(() => as('union_eyes_runtime', orgA, () => db.query(`DELETE FROM satisfaction_survey_responded`)), /permission denied/)
    })

    it('still completes an anonymous response written by the runtime role under row security', async () => {
      const claimId = randomUUID()
      const id = await survey(claimId, 'm-rt', true)
      await db.query('BEGIN')
      try {
        await db.query(`SET LOCAL ROLE union_eyes_runtime`)
        await db.query(`SELECT set_config('app.current_org_id', $1, true)`, [orgA])
        await db.query(`UPDATE satisfaction_surveys SET status = 'completed', completed_at = now() WHERE id = $1`, [id])
        await db.query('COMMIT')
      } catch (error) {
        await db.query('ROLLBACK')
        throw error
      }
      expect((await db.query(`SELECT member_id, claim_id FROM satisfaction_surveys WHERE id = $1`, [id])).rows[0]).toEqual({ member_id: null, claim_id: null })
      expect((await db.query(`SELECT member_id FROM satisfaction_survey_responded WHERE claim_id = $1`, [claimId])).rows).toEqual([{ member_id: 'm-rt' }])
    })

    it('rolls back: the trigger, the check and the responded record go; the discarded links are not restored', async () => {
      await migrate(cache(C0040, true))
      await migrate(platform(M0050, true))
      expect(await exists('satisfaction_survey_responded')).toBe(false)
      expect((await db.query(`SELECT count(*)::int AS n FROM satisfaction_surveys WHERE member_id IS NULL`)).rows[0].n).toBeGreaterThan(0)
      expect((await db.query(`SELECT is_nullable FROM information_schema.columns WHERE table_name='satisfaction_surveys' AND column_name='member_id'`)).rows[0].is_nullable).toBe('YES')
    })
  })

  describe('0051 + 0041: arbitration decision owner', () => {
    const decision = (caseNumber: string, source: string | null, isPublic: boolean | null, restrictions: string | null = null, importedFrom: string | null = null) =>
      db.query(`INSERT INTO arbitration_decisions (case_number, source_organization_id, is_public, access_restrictions, imported_from) VALUES ($1, $2, $3, $4, $5)`, [caseNumber, source, isPublic, restrictions, importedFrom])

    it('adds the owner column, defaults new decisions to not public, and recovers the owner of typed rows', async () => {
      await db.query(`INSERT INTO arbitration_decisions (case_number, imported_from) VALUES ('typed-by-a', 'typed:${orgA}:user-1'), ('typed-unknown-org', 'typed:${randomUUID()}:user-1'), ('platform', NULL)`)
      await migrate(platform(M0051))
      await migrate(platform(M0051))
      const byCase = Object.fromEntries((await db.query(`SELECT case_number, source_organization_id FROM arbitration_decisions`)).rows.map((r) => [r.case_number, r.source_organization_id]))
      expect(byCase).toEqual({ 'typed-by-a': orgA, 'typed-unknown-org': null, platform: null })
      await db.query(`INSERT INTO arbitration_decisions (case_number) VALUES ('new-default')`)
      expect((await db.query(`SELECT is_public FROM arbitration_decisions WHERE case_number = 'new-default'`)).rows[0].is_public).toBe(false)
      await rejects(() => decision('bad-owner', randomUUID(), false), /violates foreign key/)
      await db.query(`DELETE FROM arbitration_decisions`)
    })

    it('0041 shows a tenant public unrestricted decisions and its own, and nothing else', async () => {
      await db.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON arbitration_decisions TO union_eyes_runtime, union_eyes_system`)
      await migrate(cache(C0041))
      await migrate(cache(C0041))
      await decision('a-private', orgA, false)
      await decision('a-public', orgA, true)
      await decision('b-private', orgB, false)
      await decision('b-public', orgB, true)
      await decision('b-public-restricted', orgB, true, 'embargoed')
      await decision('b-public-empty-restriction', orgB, true, '')
      await decision('platform-public', null, true)
      await decision('platform-private', null, false)
      await decision('b-unclassified', orgB, null)

      const seen = (org: string | undefined) => as('union_eyes_runtime', org, async () => (await db.query(`SELECT case_number FROM arbitration_decisions ORDER BY case_number`)).rows.map((r) => r.case_number as string))
      expect(await seen(orgA)).toEqual(['a-private', 'a-public', 'b-public', 'b-public-empty-restriction', 'platform-public'])
      expect(await seen(orgB)).toEqual(['a-public', 'b-private', 'b-public', 'b-public-empty-restriction', 'b-public-restricted', 'b-unclassified', 'platform-public'].sort())
      expect(await seen(undefined)).toEqual(['a-public', 'b-public', 'b-public-empty-restriction', 'platform-public'])
      expect(await seen('not-a-uuid')).toEqual(['a-public', 'b-public', 'b-public-empty-restriction', 'platform-public'])
    })

    it('0041 lets only the owning organization write its decisions, and only the system role touch an ownerless one', async () => {
      const count = (org: string, sql: string, params: unknown[] = []) => as('union_eyes_runtime', org, async () => (await db.query(sql, params)).rowCount)
      expect(await count(orgA, `UPDATE arbitration_decisions SET case_number = case_number WHERE case_number = 'b-public'`)).toBe(0)
      expect(await count(orgA, `UPDATE arbitration_decisions SET case_number = case_number WHERE case_number = 'a-public'`)).toBe(1)
      expect(await count(orgA, `UPDATE arbitration_decisions SET case_number = case_number WHERE case_number = 'platform-public'`)).toBe(0)
      expect(await count(orgA, `DELETE FROM arbitration_decisions WHERE case_number = 'b-public'`)).toBe(0)
      expect(await count(orgA, `DELETE FROM arbitration_decisions WHERE case_number = 'a-private'`)).toBe(1)
      await rejects(() => count(orgA, `INSERT INTO arbitration_decisions (case_number, source_organization_id) VALUES ('forged', '${orgB}')`), /row-level security/)
      await rejects(() => count(orgA, `INSERT INTO arbitration_decisions (case_number) VALUES ('ownerless')`), /row-level security/)
      await rejects(() => count(orgA, `UPDATE arbitration_decisions SET source_organization_id = '${orgB}' WHERE case_number = 'a-public'`), /row-level security/)
      expect(await count(orgA, `INSERT INTO arbitration_decisions (case_number, source_organization_id) VALUES ('mine', '${orgA}')`)).toBe(1)
      expect(await as('union_eyes_system', undefined, async () => (await db.query(`UPDATE arbitration_decisions SET case_number = case_number WHERE case_number = 'platform-private'`)).rowCount)).toBe(1)
    })

    it('rolls back 0041 and 0051', async () => {
      await migrate(cache(C0041, true))
      expect(await policyNames('arbitration_decisions')).toEqual([])
      await migrate(platform(M0051, true))
      expect(await columns('arbitration_decisions')).not.toContain('source_organization_id')
      expect((await db.query(`SELECT column_default FROM information_schema.columns WHERE table_name='arbitration_decisions' AND column_name='is_public'`)).rows[0].column_default).toBe('true')
    })
  })

  describe('the combined Django + Drizzle database, built by the approved bootstrap (catalog state only)', () => {
    let combined: pg.Client
    beforeAll(async () => {
      combined = new pg.Client({ connectionString: URL_ })
      await combined.connect()
    })
    afterAll(async () => {
      await combined?.end()
    })

    const privileges = async (table: string, role: string) =>
      (await combined.query(`SELECT privilege_type FROM information_schema.role_table_grants WHERE table_schema='public' AND table_name=$1 AND grantee=$2 ORDER BY privilege_type`, [table, role])).rows.map((r) => r.privilege_type as string)

    it('applied every migration: the tables and columns exist', async () => {
      for (const table of ['claim_status_transitions', 'satisfaction_survey_responded']) {
        expect((await combined.query(`SELECT to_regclass($1) AS t`, [`public.${table}`])).rows[0].t, table).not.toBeNull()
      }
      const cols = async (table: string) => (await combined.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`, [table])).rows.map((r) => r.column_name as string)
      expect(await cols('claims')).toContain('status_changed_at')
      expect(await cols('scim_configurations')).toEqual(expect.arrayContaining(['token_hash', 'revoked_at']))
      expect(await cols('scim_configurations')).not.toContain('bearer_token')
      expect(await cols('arbitration_decisions')).toContain('source_organization_id')
    })

    it('forces row security on all four tables', async () => {
      const rows = (await combined.query(`SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relname IN ('scim_configurations','claim_status_transitions','satisfaction_survey_responded','arbitration_decisions') ORDER BY relname`)).rows
      expect(rows).toHaveLength(4)
      for (const r of rows) expect(r, r.relname).toMatchObject({ relrowsecurity: true, relforcerowsecurity: true })
    })

    it('grants the history tables SELECT only, and lets nobody call the SECURITY DEFINER trigger functions', async () => {
      for (const table of ['claim_status_transitions', 'satisfaction_survey_responded']) {
        expect(await privileges(table, 'union_eyes_runtime'), `${table} runtime`).toEqual(['SELECT'])
        expect((await privileges(table, 'union_eyes_system')).filter((p) => p !== 'SELECT'), `${table} system`).toEqual([])
      }
      for (const fn of ['public.ue_claims_record_status_transition()', 'public.ue_satisfaction_anonymize_response()']) {
        for (const role of ['union_eyes_runtime', 'union_eyes_system', 'public']) {
          expect((await combined.query(`SELECT has_function_privilege('${role}', '${fn}', 'EXECUTE') AS ok`)).rows[0].ok, `${fn} ${role}`).toBe(false)
        }
      }
    })

    it('stores no SCIM credential in the clear and gives the runtime role no way to delete a configuration', async () => {
      expect(await privileges('scim_configurations', 'union_eyes_runtime')).toEqual(['INSERT', 'SELECT', 'UPDATE'])
      expect((await combined.query(`SELECT 1 FROM pg_constraint WHERE conrelid = 'public.scim_configurations'::regclass AND conname = 'scim_configurations_token_hash_check'`)).rowCount).toBe(1)
    })
  })})

/**
 * Platform 0075 and 0076 and cache 0053 on real PostgreSQL: each rolls back, refuses what it must, and applies again (UE-CONV-H-010).
 *
 * A rollback that has never run is a claim, not a property. This runs them, in the order an operator would: the catalog (0076) first, then the relations (0075), and the row
 * security (cache 0053) around them, each over the database the bootstrap built, then applies them again:
 *   - 0076's rollback refuses while a member holds a seeded role, removes the seed, the triggers and the functions, and leaves a custom role alone; its migration refuses to
 *     overwrite a custom role that uses a seeded code, and applying it twice changes nothing;
 *   - 0075's rollback refuses a relation that holds rows or that it did not create, and drops the four relations when they are empty (its generated rollback once carried an
 *     untyped empty array that PostgreSQL refuses at run time); its migration refuses to run over relations that exist;
 *   - cache 0053's rollback removes the policies and row security, and applying it again restores them;
 *   - after all of it the relations are what they were: columns, tag, forced row security, seed, triggers, and no runtime or system privilege until the manifest grants them.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database (each test file runs in its own clone).
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
const DB = join(__dirname, '..')
const platform = (file: string) => readFileSync(join(DB, 'migrations-platform', file), 'utf8').replace(/\r\n/g, '\n')
const cache = (file: string) => readFileSync(join(DB, 'migrations-cache', file), 'utf8').replace(/\r\n/g, '\n')

const TABLES = ['role_definitions', 'member_roles', 'permission_exceptions', 'rbac_audit_log'] as const
const COLUMNS: Record<(typeof TABLES)[number], number> = { role_definitions: 17, member_roles: 33, permission_exceptions: 21, rbac_audit_log: 34 }
const TAG = 'platform-migration:enhanced_rbac_relations'
const SEEDED = ['admin', 'president', 'vice_president', 'secretary_treasurer', 'chief_steward', 'officer', 'clerk', 'steward', 'bargaining_committee', 'health_safety_rep', 'member']

describe.skipIf(!URL)('the enhanced RBAC migrations roll back and apply again', () => {
  let admin: pg.Client
  const ORG = randomUUID()
  let member: string

  // A whole migration file runs as one multi-statement script, one implicit transaction: a refusal leaves nothing half done.
  const run = (sql: string) => admin.query(sql)
  const messageOf = async (work: () => Promise<unknown>): Promise<string> => {
    try {
      await work()
      return 'no error'
    } catch (error) {
      return (error as Error).message
    }
  }
  const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await admin.query(sql, params)).rows[0] as T
  const exists = async (table: string) => (await one<{ r: string | null }>(`SELECT to_regclass($1)::text AS r`, [`public.${table}`])).r !== null
  const triggers = async () =>
    (await admin.query(`SELECT tgname FROM pg_trigger WHERE NOT tgisinternal AND tgrelid = ANY(ARRAY['public.member_roles','public.permission_exceptions','public.rbac_audit_log']::regclass[]) ORDER BY tgname`)).rows.map((r) => r.tgname)
  const functions = async () =>
    (await admin.query(`SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN ('rbac_audit_log_append_only', 'rbac_member_organization_guard') ORDER BY proname`)).rows.map((r) => r.proname)
  const seeded = async () => (await one<{ n: number }>(`SELECT count(*)::int AS n FROM role_definitions WHERE is_system_role`)).n
  const policies = async () =>
    (await admin.query(`SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = ANY($1) ORDER BY tablename, policyname`, [['member_roles', 'permission_exceptions', 'rbac_audit_log']])).rows.map((r) => `${r.tablename}.${r.policyname}`)

  const FULL_POLICIES = ['member_roles', 'permission_exceptions', 'rbac_audit_log'].flatMap((t) =>
    ['ue_org_isolation_delete', 'ue_org_isolation_insert', 'ue_org_isolation_select', 'ue_org_isolation_update', 'ue_system_full_access'].map((p) => `${t}.${p}`),
  )
  const EXPECTED_TRIGGERS = ['member_roles_member_organization', 'permission_exceptions_member_organization', 'rbac_audit_log_append_only', 'rbac_audit_log_no_truncate']

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    await admin.query(
      `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
       VALUES ($1,'RB Org',$2,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`,
      [ORG, `rb-${ORG.slice(0, 8)}`],
    )
    member = (
      await one<{ id: string }>(
        `INSERT INTO organization_members (id, user_id, organization_id, name, email, role, status, is_primary, created_at, updated_at, metadata)
         VALUES (gen_random_uuid(), $1, $2, 'RB Member', $3, 'member', 'active', false, now(), now(), '{}'::jsonb) RETURNING id::text id`,
        [`rb-${randomUUID().slice(0, 8)}`, ORG, `rb-${randomUUID().slice(0, 8)}@example.test`],
      )
    ).id
  }, 120_000)

  afterAll(async () => {
    await admin?.end().catch(() => undefined)
  })

  it('starts as the bootstrap built it', async () => {
    for (const table of TABLES) expect((await one<{ n: number }>(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`, [table])).n, table).toBe(COLUMNS[table])
    expect(await seeded()).toBe(11)
    expect(await triggers()).toEqual(EXPECTED_TRIGGERS)
    expect(await functions()).toEqual(['rbac_audit_log_append_only', 'rbac_member_organization_guard'])
    expect(await policies()).toEqual(FULL_POLICIES)
  })

  describe('0076, the catalog and the guards', () => {
    it('refuses its rollback while a member holds a seeded role, and changes nothing', async () => {
      const assignment = (await one<{ id: string }>(`INSERT INTO member_roles (member_id, organization_id, role_code, created_by) VALUES ($1, $2, 'steward', 'native') RETURNING id::text id`, [member, ORG])).id
      expect(await messageOf(() => run(platform('0076_enhanced_rbac_catalog.rollback.sql')))).toMatch(/rollback fail-closed: member_roles still holds a seeded system role/)
      expect(await seeded()).toBe(11)
      expect(await triggers()).toEqual(EXPECTED_TRIGGERS)
      await admin.query(`DELETE FROM member_roles WHERE id = $1`, [assignment])
    })

    it('rolls back to no seed, no trigger and no function, and leaves a custom role alone', async () => {
      await admin.query(`INSERT INTO role_definitions (role_code, role_name, role_level, permissions) VALUES ('rb_custom', 'Custom', 5, '[]'::jsonb)`)
      await run(platform('0076_enhanced_rbac_catalog.rollback.sql'))
      expect(await seeded()).toBe(0)
      expect((await admin.query(`SELECT role_code FROM role_definitions`)).rows.map((r) => r.role_code)).toEqual(['rb_custom'])
      expect(await triggers()).toEqual([])
      expect(await functions()).toEqual([])
      // the guards are gone: the trail can be edited again, which is what rolling the guard back means
      await admin.query(
        `INSERT INTO rbac_audit_log (actor_id, action, resource_type, organization_id, granted, record_hash) VALUES ('a', 'x', 'claim', $1, true, $2)`,
        [ORG, `h-${randomUUID()}`],
      )
      await admin.query(`UPDATE rbac_audit_log SET granted = false WHERE organization_id = $1`, [ORG])
      await admin.query(`DELETE FROM rbac_audit_log WHERE organization_id = $1`, [ORG])
    })

    it('refuses to apply over a custom role that uses a seeded code, and overwrites nothing', async () => {
      await admin.query(`INSERT INTO role_definitions (role_code, role_name, role_level, permissions) VALUES ('steward', 'My steward', 7, '["mine"]'::jsonb)`)
      expect(await messageOf(() => run(platform('0076_enhanced_rbac_catalog.sql')))).toMatch(/a custom role already uses a system role code \(steward\)/)
      expect(await seeded()).toBe(0)
      expect(await triggers()).toEqual([])
      expect((await one<{ role_name: string }>(`SELECT role_name FROM role_definitions WHERE role_code = 'steward'`)).role_name).toBe('My steward')
      await admin.query(`DELETE FROM role_definitions WHERE role_code = 'steward'`)
    })

    it('applies again, and applying twice changes nothing', async () => {
      await run(platform('0076_enhanced_rbac_catalog.sql'))
      expect(await seeded()).toBe(11)
      expect(await triggers()).toEqual(EXPECTED_TRIGGERS)
      expect(await functions()).toEqual(['rbac_audit_log_append_only', 'rbac_member_organization_guard'])
      const before = (await admin.query(`SELECT role_code, role_level, permissions::text AS permissions, updated_at FROM role_definitions WHERE is_system_role ORDER BY role_code`)).rows
      await run(platform('0076_enhanced_rbac_catalog.sql'))
      const after = (await admin.query(`SELECT role_code, role_level, permissions::text AS permissions, updated_at FROM role_definitions WHERE is_system_role ORDER BY role_code`)).rows
      expect(after.map((r) => [r.role_code, r.role_level, r.permissions])).toEqual(before.map((r) => [r.role_code, r.role_level, r.permissions]))
      expect(after.map((r) => r.role_code).sort()).toEqual([...SEEDED].sort())
      // the seed is what it was: a hand-edited seeded role is put back, a custom role is not touched
      await admin.query(`UPDATE role_definitions SET role_level = 999 WHERE role_code = 'member'`)
      await run(platform('0076_enhanced_rbac_catalog.sql'))
      expect((await one<{ role_level: number }>(`SELECT role_level FROM role_definitions WHERE role_code = 'member'`)).role_level).toBe(20)
      expect((await one<{ role_name: string }>(`SELECT role_name FROM role_definitions WHERE role_code = 'rb_custom'`)).role_name).toBe('Custom')
    })
  })

  describe('0075, the relations', () => {
    it('refuses its rollback while a relation holds rows (the seed is rows), and while a relation is not its own', async () => {
      expect(await messageOf(() => run(platform('0075_enhanced_rbac_relations.rollback.sql')))).toMatch(/rollback enhanced_rbac_relations refuses: role_definitions holds rows/)
      expect(await exists('role_definitions')).toBe(true)

      await run(platform('0076_enhanced_rbac_catalog.rollback.sql'))
      await admin.query(`DELETE FROM role_definitions`)
      await admin.query(`COMMENT ON TABLE public.member_roles IS 'someone else made this'`)
      expect(await messageOf(() => run(platform('0075_enhanced_rbac_relations.rollback.sql')))).toMatch(/refuses: member_roles was not created by this migration/)
      await admin.query(`COMMENT ON TABLE public.member_roles IS '${TAG}'`)
    })

    it('refuses to apply over relations that exist', async () => {
      expect(await messageOf(() => run(platform('0075_enhanced_rbac_relations.sql')))).toMatch(/relations already exist and are not replaced/)
    })

    it('drops the four relations when they are empty', async () => {
      await run(cache('0053_enhanced_rbac_rls_closure.rollback.sql'))
      await run(platform('0075_enhanced_rbac_relations.rollback.sql'))
      for (const table of TABLES) expect(await exists(table), table).toBe(false)
    })

    it('applies again with the cache closure and the catalog: the relations are what they were', async () => {
      await run(platform('0075_enhanced_rbac_relations.sql'))
      await run(cache('0053_enhanced_rbac_rls_closure.sql'))
      await run(platform('0076_enhanced_rbac_catalog.sql'))
      for (const table of TABLES) {
        expect((await one<{ n: number }>(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`, [table])).n, `${table} columns`).toBe(COLUMNS[table])
        expect((await one<{ c: string }>(`SELECT obj_description(to_regclass($1), 'pg_class') AS c`, [`public.${table}`])).c, `${table} tag`).toBe(TAG)
      }
      expect(await seeded()).toBe(11)
      expect(await triggers()).toEqual(EXPECTED_TRIGGERS)
      expect(await policies()).toEqual(FULL_POLICIES)
      const forced = (await admin.query(`SELECT relname FROM pg_class WHERE oid = ANY($1::regclass[]) AND relrowsecurity AND relforcerowsecurity ORDER BY relname`, [TABLES.filter((t) => t !== 'role_definitions').map((t) => `public.${t}`)])).rows.map((r) => r.relname)
      expect(forced).toEqual(['member_roles', 'permission_exceptions', 'rbac_audit_log'])
      // nothing is granted by a migration: the manifest grants at activation
      for (const role of ['union_eyes_runtime', 'union_eyes_system']) {
        for (const table of TABLES) expect((await one<{ ok: boolean }>(`SELECT has_table_privilege($1, $2, 'SELECT') AS ok`, [role, `public.${table}`])).ok, `${role} on ${table}`).toBe(false)
      }
    })
  })

  describe('cache 0053, the row security', () => {
    it('rolls back to no policy and no forced row security, and applies again', async () => {
      await run(cache('0053_enhanced_rbac_rls_closure.rollback.sql'))
      expect(await policies()).toEqual([])
      expect((await admin.query(`SELECT relname FROM pg_class WHERE oid = ANY($1::regclass[]) AND (relrowsecurity OR relforcerowsecurity)`, [['public.member_roles', 'public.permission_exceptions', 'public.rbac_audit_log']])).rows).toEqual([])
      await run(cache('0053_enhanced_rbac_rls_closure.sql'))
      expect(await policies()).toEqual(FULL_POLICIES)
      // applying it twice is the same
      await run(cache('0053_enhanced_rbac_rls_closure.sql'))
      expect(await policies()).toEqual(FULL_POLICIES)
    })

    it('fails closed when the relations it closes are not there', async () => {
      await run(cache('0053_enhanced_rbac_rls_closure.rollback.sql'))
      await run(platform('0076_enhanced_rbac_catalog.rollback.sql'))
      await admin.query(`DELETE FROM role_definitions`)
      await run(platform('0075_enhanced_rbac_relations.rollback.sql'))
      expect(await messageOf(() => run(cache('0053_enhanced_rbac_rls_closure.sql')))).toMatch(/public\.member_roles does not exist \(platform 0075 not applied\)/)
    })
  })
})

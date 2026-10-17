import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import type pg from 'pg'
import { AUTH_BUSINESS_ORG_PREDICATE, AUTH_BUSINESS_USER_PARENT_PREDICATE, AUTH_BUSINESS_MEMBER_PARENT_PREDICATE, authBusinessContextSettings } from './auth-sql'
import { inspectAuthPrivilegeExpectations } from './auth-privileges'

export const AUTH_ORG_FIXTURE = {
  actorA: 'auth-proof-org-a', actorB: 'auth-proof-org-b',
  memberB: 'auth-proof-org-member-b',
  orgA: '33333333-3333-4333-8333-333333333333', orgB: '44444444-4444-4444-8444-444444444444',
  tokenA: 'synthetic-org-session-a-only', tokenB: 'synthetic-org-session-b-only',
} as const

const REQUIRED = ['member-own-org', 'forged-org', 'forged-actor', 'missing-bearer', 'stored-hash-is-not-bearer',
  'member-is-not-admin', 'admin-own-org-not-cross-org', 'inactive-membership', 'inactive-session', 'expired-session',
  'inactive-user', 'session-org-binding', 'explicit-other-membership-with-orgless-session',
  'legacy-system-denied', 'helper-column-overgrant-detected', 'public-execute-overgrant-detected', 'context-cleanup',
  'own-user-parent-insert', 'foreign-user-parent-injection', 'foreign-user-parent-update',
  'parent-forged-actor', 'parent-helper-no-direct-select',
  'member-parent-same-org-write', 'member-parent-foreign', 'member-parent-inactive-user',
  'member-parent-inactive-lifecycle', 'member-parent-inactive-membership', 'member-parent-unknown',
  'member-parent-forged-session', 'member-parent-forged-actor', 'member-parent-forged-org',
  'member-parent-legacy-denied', 'member-parent-overgrant-detected'] as const

/**
 * Local synthetic RLS proof. Creates a reserved test table and removes it before
 * returning; never installs a business policy or leaves a manifest exception.
 */
export async function proveAuthOrgBindingBoundary(clients: { owner: pg.Client; ordinary: pg.Client; legacySystem: pg.Client }) {
  for (const client of Object.values(clients))
    if (!['127.0.0.1', 'localhost', '::1'].includes((client as unknown as { host: string }).host))
      throw new Error('Auth organization proof requires local synthetic PostgreSQL')
  const { owner, ordinary, legacySystem } = clients
  const fixture = AUTH_ORG_FIXTURE
  const hash = (token: string) => createHash('sha256').update(token).digest('hex')
  const passed: string[] = []
  const failures: { path: string; error: string }[] = []
  let created = false
  const check = async (path: typeof REQUIRED[number], work: () => Promise<void>) => {
    try { await work(); passed.push(path) }
    catch (error) { failures.push({ path, error: error instanceof Error ? error.message : String(error) }) }
  }
  const scoped = async <T>(binding: { userId: string; organizationId: string; sessionToken: string }, work: () => Promise<T>) => {
    await ordinary.query('BEGIN')
    try {
      for (const [key, value] of Object.entries(authBusinessContextSettings(binding)))
        await ordinary.query('SELECT set_config($1,$2,true)', [key, value])
      // These forgeable strings must confer no administrator authority.
      await ordinary.query("SELECT set_config('app.current_role','admin',true),set_config('app.is_platform_admin','true',true)")
      return await work()
    } finally { await ordinary.query('ROLLBACK') }
  }
  const bindingA = { userId: fixture.actorA, organizationId: fixture.orgA, sessionToken: fixture.tokenA }
  const rows = async () => (await ordinary.query('SELECT organization_id::text FROM public.auth_proof_business_scope ORDER BY organization_id')).rows
  try {
    await owner.query('BEGIN')
    try {
      await owner.query(`INSERT INTO user_management.users(user_id,email,is_active,lifecycle_state,is_system_admin)
        VALUES ($1,'org-a@example.invalid',true,'active',true),($2,'org-b@example.invalid',true,'active',false)`, [fixture.actorA, fixture.actorB])
      await owner.query(`INSERT INTO user_management.organization_users(user_id,organization_id,role,is_active)
        VALUES ($1,$2,'member',true),($3,$4,'admin',true)`, [fixture.actorA, fixture.orgA, fixture.actorB, fixture.orgB])
      await owner.query(`INSERT INTO user_management.users(user_id,email,is_active,lifecycle_state)
        VALUES ($1,'member-b@example.invalid',true,'active')`, [fixture.memberB])
      await owner.query(`INSERT INTO user_management.organization_users(user_id,organization_id,role,is_active)
        VALUES ($1,$2,'member',true)`, [fixture.memberB, fixture.orgB])
      await owner.query(`INSERT INTO user_management.user_sessions(user_id,organization_id,session_token,session_token_hash,created_at,expires_at,is_active)
        VALUES ($1,$2,$3,$3,now()-interval '1 hour',now()+interval '1 hour',true),
          ($4,$5,$6,$6,now()-interval '1 hour',now()+interval '1 hour',true)`,
      [fixture.actorA, fixture.orgA, hash(fixture.tokenA), fixture.actorB, fixture.orgB, hash(fixture.tokenB)])
      await owner.query(`CREATE TABLE public.auth_proof_business_scope(
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,value text NOT NULL,
          parent_user_id varchar(255) NOT NULL REFERENCES user_management.users(user_id),
          attribution_user_id varchar(255) REFERENCES user_management.users(user_id));
        INSERT INTO public.auth_proof_business_scope(organization_id,value,parent_user_id)
          VALUES ('${fixture.orgA}','a','${fixture.actorA}'),('${fixture.orgB}','b','${fixture.actorB}');
        ALTER TABLE public.auth_proof_business_scope ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.auth_proof_business_scope FORCE ROW LEVEL SECURITY;
        GRANT SELECT,INSERT,UPDATE ON public.auth_proof_business_scope TO union_eyes_runtime;
        CREATE POLICY auth_proof_read ON public.auth_proof_business_scope FOR SELECT TO union_eyes_runtime
          USING (${AUTH_BUSINESS_ORG_PREDICATE}(organization_id));
        CREATE POLICY auth_proof_admin ON public.auth_proof_business_scope FOR UPDATE TO union_eyes_runtime
          USING (${AUTH_BUSINESS_ORG_PREDICATE}(organization_id,ARRAY['admin']::text[]))
          WITH CHECK (${AUTH_BUSINESS_ORG_PREDICATE}(organization_id,ARRAY['admin']::text[])
            AND ${AUTH_BUSINESS_USER_PARENT_PREDICATE}(parent_user_id,organization_id)
            AND (attribution_user_id IS NULL OR ${AUTH_BUSINESS_MEMBER_PARENT_PREDICATE}(attribution_user_id,organization_id)));
        CREATE POLICY auth_proof_parent_insert ON public.auth_proof_business_scope FOR INSERT TO union_eyes_runtime
          WITH CHECK (${AUTH_BUSINESS_USER_PARENT_PREDICATE}(parent_user_id,organization_id)
            AND (attribution_user_id IS NULL OR ${AUTH_BUSINESS_MEMBER_PARENT_PREDICATE}(attribution_user_id,organization_id)));`)
      await owner.query('COMMIT')
      created = true
    } catch (error) { await owner.query('ROLLBACK'); throw error }
    await check('member-own-org', async () => {
      assert.deepEqual(await scoped(bindingA, rows), [{ organization_id: fixture.orgA }])
    })
    const insertParent = (organizationId: string, parentUserId: string) => ordinary.query(
      "INSERT INTO public.auth_proof_business_scope(organization_id,value,parent_user_id) VALUES ($1,'parent-proof',$2)",
      [organizationId, parentUserId])
    await check('own-user-parent-insert', async () => {
      assert.equal((await scoped(bindingA, () => insertParent(fixture.orgA, fixture.actorA))).rowCount, 1)
    })
    await check('foreign-user-parent-injection', async () => {
      // The real FK accepts this existing foreign user; the principal predicate must reject it.
      await owner.query('BEGIN')
      try {
        assert.equal((await owner.query(`INSERT INTO public.auth_proof_business_scope(organization_id,value,parent_user_id)
          VALUES ($1,'fk-accepts-foreign-parent',$2)`, [fixture.orgA, fixture.actorB])).rowCount, 1)
      } finally { await owner.query('ROLLBACK') }
      await assert.rejects(scoped(bindingA, () => insertParent(fixture.orgA, fixture.actorB)), { code: '42501' })
    })
    await check('foreign-user-parent-update', async () => {
      await assert.rejects(scoped({
        userId: fixture.actorB, organizationId: fixture.orgB, sessionToken: fixture.tokenB,
      }, () => ordinary.query('UPDATE public.auth_proof_business_scope SET parent_user_id=$1', [fixture.actorA])), { code: '42501' })
    })
    await check('parent-forged-actor', async () => {
      await assert.rejects(scoped({ ...bindingA, userId: fixture.actorB, organizationId: fixture.orgB },
        () => insertParent(fixture.orgB, fixture.actorB)), { code: '42501' })
    })
    await check('parent-helper-no-direct-select', async () => {
      await assert.rejects(ordinary.query('SELECT user_id FROM user_management.users'), { code: '42501' })
      await scoped(bindingA, async () => {
        const { rows: result } = await ordinary.query(`SELECT ${AUTH_BUSINESS_USER_PARENT_PREDICATE}($1,$2) AS allowed`,
          [fixture.actorA, fixture.orgA])
        assert.equal(result[0].allowed, true)
      })
    })
    const bindingB = { userId: fixture.actorB, organizationId: fixture.orgB, sessionToken: fixture.tokenB }
    const insertAttribution = (target: string) => ordinary.query(
      `INSERT INTO public.auth_proof_business_scope(organization_id,value,parent_user_id,attribution_user_id)
        VALUES ($1,'attribution-proof',$2,$3)`, [fixture.orgB, fixture.actorB, target])
    const deniedAttribution = (target: string) => assert.rejects(
      scoped(bindingB, () => insertAttribution(target)), { code: '42501' })
    await check('member-parent-same-org-write', async () => {
      await scoped(bindingB, async () => {
        assert.equal((await insertAttribution(fixture.memberB)).rowCount, 1)
        assert.equal((await ordinary.query(`UPDATE public.auth_proof_business_scope SET value='retained-attribution'
          WHERE attribution_user_id=$1`, [fixture.memberB])).rowCount, 1)
        assert.equal((await ordinary.query(`SELECT ${AUTH_BUSINESS_USER_PARENT_PREDICATE}($1,$2) AS allowed`,
          [fixture.memberB, fixture.orgB])).rows[0].allowed, false)
      })
    })
    await check('member-parent-foreign', async () => {
      await deniedAttribution(fixture.actorA)
      await assert.rejects(scoped(bindingB, () => ordinary.query(
        'UPDATE public.auth_proof_business_scope SET attribution_user_id=$1', [fixture.actorA])), { code: '42501' })
    })
    await check('member-parent-inactive-user', async () => {
      try {
        await owner.query('UPDATE user_management.users SET is_active=false WHERE user_id=$1', [fixture.memberB])
        await deniedAttribution(fixture.memberB)
      } finally { await owner.query('UPDATE user_management.users SET is_active=true WHERE user_id=$1', [fixture.memberB]) }
    })
    await check('member-parent-inactive-lifecycle', async () => {
      try {
        await owner.query("UPDATE user_management.users SET lifecycle_state='suspended' WHERE user_id=$1", [fixture.memberB])
        await deniedAttribution(fixture.memberB)
      } finally { await owner.query("UPDATE user_management.users SET lifecycle_state='active' WHERE user_id=$1", [fixture.memberB]) }
    })
    await check('member-parent-inactive-membership', async () => {
      try {
        await owner.query('UPDATE user_management.organization_users SET is_active=false WHERE user_id=$1', [fixture.memberB])
        await deniedAttribution(fixture.memberB)
      } finally { await owner.query('UPDATE user_management.organization_users SET is_active=true WHERE user_id=$1', [fixture.memberB]) }
    })
    await check('member-parent-unknown', async () => {
      await deniedAttribution('auth-proof-org-unknown-parent')
      await scoped(bindingB, async () => {
        assert.equal((await ordinary.query(`SELECT ${AUTH_BUSINESS_MEMBER_PARENT_PREDICATE}(NULL,$1) AS allowed`,
          [fixture.orgB])).rows[0].allowed, false)
      })
    })
    for (const [path, binding] of [
      ['member-parent-forged-session', { ...bindingB, sessionToken: fixture.tokenA }],
      ['member-parent-forged-actor', { ...bindingB, userId: fixture.actorA }],
      ['member-parent-forged-org', { ...bindingB, organizationId: fixture.orgA }],
    ] as const) await check(path, async () => {
      await assert.rejects(scoped(binding, () => insertAttribution(fixture.memberB)), { code: '42501' })
    })
    await check('member-parent-legacy-denied', async () => {
      await assert.rejects(legacySystem.query(`SELECT ${AUTH_BUSINESS_MEMBER_PARENT_PREDICATE}($1,$2)`,
        [fixture.memberB, fixture.orgB]), { code: '42501' })
    })
    await check('member-parent-overgrant-detected', async () => {
      try {
        await owner.query(`GRANT EXECUTE ON FUNCTION ${AUTH_BUSINESS_MEMBER_PARENT_PREDICATE}(text,uuid) TO PUBLIC`)
        const report = await inspectAuthPrivilegeExpectations(owner)
        assert.equal(report.result, 'FAIL')
        assert(report.failures.some(failure => failure.includes('auth_business_member_parent_authorized:EXECUTE')))
      } finally { await owner.query(`REVOKE EXECUTE ON FUNCTION ${AUTH_BUSINESS_MEMBER_PARENT_PREDICATE}(text,uuid) FROM PUBLIC`) }
      assert.equal((await inspectAuthPrivilegeExpectations(owner)).result, 'PASS')
    })
    await check('forged-org', async () => {
      assert.deepEqual(await scoped({ ...bindingA, organizationId: fixture.orgB }, rows), [])
    })
    await check('forged-actor', async () => {
      assert.deepEqual(await scoped({ ...bindingA, userId: fixture.actorB, organizationId: fixture.orgB }, rows), [])
    })
    await check('missing-bearer', async () => {
      await scoped(bindingA, async () => {
        await ordinary.query("SELECT set_config('app.current_session_token','',true)")
        assert.deepEqual(await rows(), [])
      })
    })
    await check('stored-hash-is-not-bearer', async () => {
      assert.deepEqual(await scoped({ ...bindingA, sessionToken: hash(fixture.tokenA) }, rows), [])
    })
    await check('member-is-not-admin', async () => {
      assert.equal((await scoped(bindingA, () => ordinary.query("UPDATE public.auth_proof_business_scope SET value='forged-admin'"))).rowCount, 0)
    })
    await check('admin-own-org-not-cross-org', async () => {
      const bindingB = { userId: fixture.actorB, organizationId: fixture.orgB, sessionToken: fixture.tokenB }
      assert.deepEqual(await scoped(bindingB, rows), [{ organization_id: fixture.orgB }])
      assert.equal((await scoped(bindingB, () => ordinary.query("UPDATE public.auth_proof_business_scope SET value='own-admin'"))).rowCount, 1)
      assert.deepEqual(await scoped({ ...bindingB, organizationId: fixture.orgA }, rows), [])
    })
    await check('inactive-membership', async () => {
      try {
        await owner.query('UPDATE user_management.organization_users SET is_active=false WHERE user_id=$1', [fixture.actorA])
        assert.deepEqual(await scoped(bindingA, rows), [])
      } finally { await owner.query('UPDATE user_management.organization_users SET is_active=true WHERE user_id=$1', [fixture.actorA]) }
    })
    await check('inactive-session', async () => {
      try {
        await owner.query('UPDATE user_management.user_sessions SET is_active=false WHERE user_id=$1', [fixture.actorA])
        assert.deepEqual(await scoped(bindingA, rows), [])
      } finally { await owner.query('UPDATE user_management.user_sessions SET is_active=true WHERE user_id=$1', [fixture.actorA]) }
    })
    await check('expired-session', async () => {
      try {
        await owner.query("UPDATE user_management.user_sessions SET expires_at=now()-interval '1 second' WHERE user_id=$1", [fixture.actorA])
        assert.deepEqual(await scoped(bindingA, rows), [])
      } finally { await owner.query("UPDATE user_management.user_sessions SET expires_at=now()+interval '1 hour' WHERE user_id=$1", [fixture.actorA]) }
    })
    await check('inactive-user', async () => {
      try {
        await owner.query("UPDATE user_management.users SET is_active=false,lifecycle_state='suspended' WHERE user_id=$1", [fixture.actorA])
        assert.deepEqual(await scoped(bindingA, rows), [])
      } finally { await owner.query("UPDATE user_management.users SET is_active=true,lifecycle_state='active' WHERE user_id=$1", [fixture.actorA]) }
    })
    await check('session-org-binding', async () => {
      await owner.query(`INSERT INTO user_management.organization_users(user_id,organization_id,role,is_active)
        VALUES ($1,$2,'admin',true)`, [fixture.actorA, fixture.orgB])
      assert.deepEqual(await scoped({ ...bindingA, organizationId: fixture.orgB }, rows), [])
    })
    await check('explicit-other-membership-with-orgless-session', async () => {
      await owner.query('UPDATE user_management.user_sessions SET organization_id=NULL WHERE user_id=$1', [fixture.actorA])
      assert.deepEqual(await scoped({ ...bindingA, organizationId: fixture.orgB }, rows), [{ organization_id: fixture.orgB }])
    })
    await check('legacy-system-denied', async () => {
      await assert.rejects(() => legacySystem.query(`SELECT ${AUTH_BUSINESS_ORG_PREDICATE}($1::uuid)`, [fixture.orgA]),
        (error: unknown) => Boolean(error && typeof error === 'object' && 'code' in error && error.code === '42501'))
    })
    await check('helper-column-overgrant-detected', async () => {
      try {
        await owner.query('GRANT SELECT (password_hash) ON user_management.users TO nzila_auth_org_authority_reader')
        const report = await inspectAuthPrivilegeExpectations(owner)
        assert.equal(report.result, 'FAIL')
        assert(report.failures.some(failure => failure.includes('nzila_auth_org_authority_reader:users.password_hash')))
      } finally { await owner.query('REVOKE SELECT (password_hash) ON user_management.users FROM nzila_auth_org_authority_reader') }
    })
    await check('public-execute-overgrant-detected', async () => {
      try {
        await owner.query(`GRANT EXECUTE ON FUNCTION ${AUTH_BUSINESS_ORG_PREDICATE}(uuid,text[]) TO PUBLIC`)
        const report = await inspectAuthPrivilegeExpectations(owner)
        assert.equal(report.result, 'FAIL')
        assert(report.failures.some(failure => failure.includes('auth_business_org_authorized:EXECUTE')))
      } finally { await owner.query(`REVOKE EXECUTE ON FUNCTION ${AUTH_BUSINESS_ORG_PREDICATE}(uuid,text[]) FROM PUBLIC`) }
      assert.equal((await inspectAuthPrivilegeExpectations(owner)).result, 'PASS')
    })
    await check('context-cleanup', async () => {
      const context = await ordinary.query("SELECT current_setting('app.current_session_token',true) AS bearer,current_setting('app.current_org_id',true) AS org")
      assert(!context.rows[0].bearer && !context.rows[0].org)
      await assert.rejects(() => ordinary.query('ALTER TABLE public.auth_proof_business_scope DISABLE ROW LEVEL SECURITY'),
        (error: unknown) => Boolean(error && typeof error === 'object' && 'code' in error && error.code === '42501'))
    })
  } finally {
    if (created) {
      await owner.query('DROP TABLE public.auth_proof_business_scope')
      await owner.query('DELETE FROM user_management.user_sessions WHERE user_id=ANY($1)', [[fixture.actorA, fixture.actorB, fixture.memberB]])
      await owner.query('DELETE FROM user_management.organization_users WHERE user_id=ANY($1)', [[fixture.actorA, fixture.actorB, fixture.memberB]])
      await owner.query('DELETE FROM user_management.users WHERE user_id=ANY($1)', [[fixture.actorA, fixture.actorB, fixture.memberB]])
    }
  }
  const executed = new Set([...passed, ...failures.map(failure => failure.path)])
  const gaps = REQUIRED.filter(path => !executed.has(path))
  return { scope: 'LOCAL_SYNTHETIC_AUTH_ORG_BOUNDARY', result: failures.length ? 'FAIL' : gaps.length ? 'PARTIAL' : 'PASS',
    requiredPaths: REQUIRED, passed, failures, gaps, stagingProof: false } as const
}

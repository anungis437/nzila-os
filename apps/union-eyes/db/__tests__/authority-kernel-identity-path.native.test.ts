/**
 * Real provider claims -> internal principal -> active membership -> live session -> authority decision -> RLS
 * context, against the Union Eyes v2 auth bootstrap (the production-intended identity architecture) on a
 * disposable PostgreSQL. Nothing here mirrors the identity relations: the tables, roles, policies and SECURITY
 * DEFINER predicates come from `compileSyntheticAuthFixtureSql()` and `compileAuthBootstrapSql()`, the provider
 * resolution is the platform resolver `resolveExternalAuthIdentity`, and the session/binding comes from
 * `createSession` and `withBearerOrgBinding`.
 *
 * Skipped unless UE_AUTHORITY_IDENTITY_NATIVE=1 (needs Docker). It starts and removes its own container.
 * What it does NOT prove: Entra token signature verification (a gateway concern), the staging/production
 * deployment of these roles, or the legacy lineage (covered by the combined-schema suite). Not a staging pass.
 */
import { execFileSync } from 'node:child_process'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { AUTH_EXECUTION_ROLES, compileAuthBootstrapSql } from '../../scripts/bootstrap-v2/auth-sql'
import { compileSyntheticAuthFixtureSql } from '../../scripts/bootstrap-v2/auth-fixture'
import { closeAuthClients } from '../../../../packages/db/src/auth-client'
import { resolveExternalAuthIdentity } from '../../../../packages/platform-auth/src/provider-identity'
import { createSession } from '../../../../packages/platform-auth/src/password/session'
import { withBearerOrgBinding } from '../../../../packages/platform-auth/src/org-binding'
import { withAuthContext } from '../../../../packages/platform-auth/src/auth-db'
import { ORG, ORG_B, installAuthoritySchema, newUuid, type Db } from './authority-kernel-harness'
import { enforceAuthority } from '../../lib/authority/store/enforce'
import { type SqlExecutor } from '../../lib/authority/store/executor'
import {
  compileAuthorityMembershipReaderSql,
  membershipSourceViaDefiner,
  resolveProviderPrincipal,
  runBoundAuthorityTransaction,
} from '../../lib/authority/store/platform-identity'

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined, set: vi.fn() }) }))

const native = process.env.UE_AUTHORITY_IDENTITY_NATIVE === '1' ? describe : describe.skip
const TENANT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const sub = (oid: string) => `${TENANT}:${oid}`
const adapt = (c: pg.Client): Db => ({ exec: (sql) => c.query(sql), query: (sql, params) => c.query(sql, params as unknown[]) as never })

native('authority kernel on the real v2 identity architecture', () => {
  const image = process.env.UE_AUTHORITY_NATIVE_IMAGE || 'postgres:16-alpine'
  const name = `ue-authority-identity-${process.pid}-${Date.now()}`
  let created = false
  let owner: pg.Client
  let runtime: pg.Client
  let system: pg.Client
  let gateway: pg.Client
  const prior = { auth: process.env.AUTH_DATABASE_URL, system: process.env.AUTH_SYSTEM_DATABASE_URL, mfa: process.env.AUTH_MFA_ENCRYPTION_KEY }
  const CASE = newUuid()

  const resolver = (provider: string, subject: string) => resolveExternalAuthIdentity(provider, subject)
  const sessionFor = async (userId: string, organizationId: string) =>
    withAuthContext({ phase: 'identity', userId }, () => createSession({ userId, organizationId }))
  const bound = <T>(token: string, organizationId: string, fn: (t: SqlExecutor) => Promise<T>) =>
    withBearerOrgBinding(token, { organizationId }, (binding) => runBoundAuthorityTransaction(runtime as unknown as SqlExecutor, binding, fn))
  const deps = { memberships: membershipSourceViaDefiner }

  beforeAll(async () => {
    execFileSync('docker', ['run', '--detach', '--name', name, '-e', 'POSTGRES_PASSWORD=synthetic-only', '-p', '127.0.0.1::5432', image], { stdio: 'pipe' })
    created = true
    const ports = JSON.parse(execFileSync('docker', ['inspect', '--format', '{{json .NetworkSettings.Ports}}', name], { encoding: 'utf8' }))
    const port = Number(ports['5432/tcp'][0].HostPort)
    for (let attempt = 0; ; attempt++) {
      try {
        execFileSync('docker', ['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'postgres'], { stdio: 'pipe' })
        const probe = new pg.Client({ host: '127.0.0.1', port, user: 'postgres', password: 'synthetic-only', database: 'postgres' })
        await probe.connect(); await probe.end()
        break
      } catch (error) {
        if (attempt >= 80) throw error
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }
    const config = { host: '127.0.0.1', port, database: 'postgres', password: 'synthetic-only' }
    owner = new pg.Client({ ...config, user: 'postgres' })
    await owner.connect()
    await owner.query(compileSyntheticAuthFixtureSql())
    await owner.query(`CREATE ROLE union_eyes_runtime LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD 'synthetic-only';
      CREATE ROLE union_eyes_system LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD 'synthetic-only';`)
    await owner.query(compileAuthBootstrapSql())
    await owner.query(compileAuthorityMembershipReaderSql())
    await owner.query(`CREATE ROLE auth_proof_login LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS PASSWORD 'synthetic-only';
      CREATE ROLE auth_proof_system_login LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS PASSWORD 'synthetic-only';
      GRANT ${AUTH_EXECUTION_ROLES.gateway} TO auth_proof_login;
      GRANT ${AUTH_EXECUTION_ROLES.systemGateway} TO auth_proof_system_login;`)
    await installAuthoritySchema(adapt(owner), { canonicalIdentity: true })
    for (const [target, user] of [['runtime', 'union_eyes_runtime'], ['system', 'union_eyes_system'], ['gateway', 'auth_proof_login']] as const) {
      const c = new pg.Client({ ...config, user })
      await c.connect()
      if (target === 'runtime') runtime = c
      if (target === 'system') system = c
      if (target === 'gateway') gateway = c
    }
    process.env.AUTH_DATABASE_URL = `postgres://auth_proof_login:synthetic-only@127.0.0.1:${port}/postgres`
    process.env.AUTH_SYSTEM_DATABASE_URL = `postgres://auth_proof_system_login:synthetic-only@127.0.0.1:${port}/postgres`
    process.env.AUTH_MFA_ENCRYPTION_KEY = '11'.repeat(32)

    await owner.query(`
      INSERT INTO user_management.users(user_id,email,password_hash) VALUES
        ('user_president','president@example.invalid','x'), ('user_member','member@example.invalid','x'),
        ('user_steward','steward@example.invalid','x'), ('entra-oid-dual','dual@example.invalid','x'),
        ('user_other_org','other@example.invalid','x');
      INSERT INTO user_management.organization_users(user_id,organization_id,role) VALUES
        ('user_president','${ORG}','president'), ('user_member','${ORG}','member'), ('user_steward','${ORG}','steward'),
        ('entra-oid-dual','${ORG}','secretary_treasurer'), ('entra-oid-dual','${ORG_B}','member'),
        ('user_other_org','${ORG_B}','president');
      INSERT INTO public.platform_identity_bindings(provider,provider_subject,platform_user_id,verified_at,provisioned_by) VALUES
        ('entra','${sub('oid-president')}','user_president',now(),'synthetic-proof'),
        ('entra','${sub('oid-member')}','user_member',now(),'synthetic-proof'),
        ('entra','${sub('oid-dual')}','entra-oid-dual',now(),'synthetic-proof'),
        ('entra','${sub('oid-susp')}','user_steward',now(),'synthetic-proof');
      INSERT INTO public.grievances(id,organization_id,created_by) VALUES ('${CASE}','${ORG}','user_member');`)
  }, 240_000)

  afterAll(async () => {
    try {
      await closeAuthClients()
      await Promise.all([runtime, system, gateway, owner].map((c) => c?.end().catch(() => undefined)))
    } finally {
      for (const [key, value] of [['AUTH_DATABASE_URL', prior.auth], ['AUTH_SYSTEM_DATABASE_URL', prior.system], ['AUTH_MFA_ENCRYPTION_KEY', prior.mfa]] as const) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
      if (created) execFileSync('docker', ['rm', '--force', name], { stdio: 'pipe' })
    }
  })

  it('no business role holds any privilege on the binding table; only the provider context resolves a subject', async () => {
    await expect(runtime.query('SELECT 1 FROM public.platform_identity_bindings')).rejects.toThrow(/permission denied/)
    await expect(system.query('SELECT 1 FROM public.platform_identity_bindings')).rejects.toThrow(/permission denied/)
    const p = await resolveProviderPrincipal(resolver, { provider: 'entra', subject: sub('oid-president') })
    expect(p.internalUserId).toBe('user_president')
  })

  it('provider claims resolve through the real resolver, and revocation, suspension and foreign subjects stop it', async () => {
    const claim = (oid: string) => resolveProviderPrincipal(resolver, { provider: 'entra', subject: sub(oid) })
    expect((await claim('oid-member')).internalUserId).toBe('user_member')
    await expect(claim('oid-never-bound')).rejects.toThrow(/no active, verified binding/)
    await expect(resolveProviderPrincipal(resolver, { provider: 'entra', subject: `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb:oid-member` })).rejects.toThrow(/no active, verified binding/)
    // suspension of the principal
    expect((await claim('oid-susp')).internalUserId).toBe('user_steward')
    await owner.query(`UPDATE user_management.users SET lifecycle_state='suspended' WHERE user_id='user_steward'`)
    await expect(claim('oid-susp')).rejects.toThrow(/no active, verified binding/)
    await owner.query(`UPDATE user_management.users SET lifecycle_state='active' WHERE user_id='user_steward'`)
    // revocation and disabling of the binding
    for (const state of ['revoked', 'disabled']) {
      await owner.query(`UPDATE public.platform_identity_bindings SET state=$1 WHERE provider_subject=$2`, [state, sub('oid-susp')])
      await expect(claim('oid-susp')).rejects.toThrow(/no active, verified binding/)
    }
    await owner.query(`UPDATE public.platform_identity_bindings SET state='active' WHERE provider_subject=$1`, [sub('oid-susp')])
    expect((await claim('oid-susp')).internalUserId).toBe('user_steward')
  })

  it('claims -> principal -> membership -> live session -> decision -> RLS context, as the runtime role', async () => {
    const { internalUserId } = await resolveProviderPrincipal(resolver, { provider: 'entra', subject: sub('oid-member') })
    const session = await sessionFor(internalUserId, ORG)
    const out = await bound(session.token, ORG, async (t) => {
      const ctx = (await t.query<{ org: string; usr: string; ok: boolean }>(
        `SELECT current_setting('app.current_org_id', true) org, current_setting('app.current_user_id', true) usr,
                user_management.auth_business_org_authorized($1::uuid) ok`, [ORG])).rows[0]
      const decision = await enforceAuthority(t, deps, { principalUserId: internalUserId, organizationId: ORG, action: 'case:read', resource: { type: 'case', id: CASE, organizationId: ORG } }, { authenticated: true })
      const members = await membershipSourceViaDefiner(t, ORG, ['user_member', 'user_president', 'user_steward', 'user_other_org'])
      return { ctx, decision, members }
    })
    expect(out.ctx).toEqual({ org: ORG, usr: 'user_member', ok: true })
    expect(out.decision.effect).toBe('allow')
    expect(out.decision.authority[0]).toMatchObject({ kind: 'relationship' })
    // The runtime sees the other members of its OWN organization through the definer, and nobody from another tenant.
    expect(out.members.map((m) => m.userId).sort()).toEqual(['user_member', 'user_president', 'user_steward'])
    expect(out.members.find((m) => m.userId === 'user_president')?.capacities).toContain('executive')
  })

  it('role is eligibility only: the president (executive capacity) has no case access without a relationship or mandate', async () => {
    const session = await sessionFor('user_president', ORG)
    const d = await bound(session.token, ORG, (t) => enforceAuthority(t, deps, { principalUserId: 'user_president', organizationId: ORG, action: 'case:read', resource: { type: 'case', id: CASE, organizationId: ORG } }, { authenticated: true }))
    expect(d.effect).toBe('deny')
  })

  it('a decision for anyone but the bound actor is refused even with a live session', async () => {
    const session = await sessionFor('user_member', ORG)
    const d = await bound(session.token, ORG, (t) => enforceAuthority(t, deps, { principalUserId: 'user_president', organizationId: ORG, action: 'case:read', resource: { type: 'case', id: CASE, organizationId: ORG } }, { authenticated: true }))
    expect(d.reasons.map((r) => r.code)).toContain('PRINCIPAL_MISMATCH')
  })

  it('multi-organization: a binding is for exactly one organization; another needs its own membership and session', async () => {
    const inA = await sessionFor('entra-oid-dual', ORG)
    const a = await bound(inA.token, ORG, (t) => membershipSourceViaDefiner(t, ORG, ['entra-oid-dual']))
    expect(a[0].capacities).toContain('financial_officer')
    await expect(bound(inA.token, ORG_B, async () => undefined)).rejects.toMatchObject({ code: expect.stringMatching(/MEMBERSHIP_REQUIRED|SESSION_AUTHORITY_REQUIRED|INVALID_ORGANIZATION/) })
    const inB = await sessionFor('entra-oid-dual', ORG_B)
    const b = await bound(inB.token, ORG_B, (t) => membershipSourceViaDefiner(t, ORG_B, ['entra-oid-dual']))
    expect(b[0].capacities).not.toContain('financial_officer')
    // The ORG_B session cannot read ORG's members, and a foreign tenant is empty.
    const cross = await bound(inB.token, ORG_B, (t) => membershipSourceViaDefiner(t, ORG, ['user_president', 'user_member']))
    expect(cross).toEqual([])
  })

  it('the membership definer needs a LIVE session: deactivated, expired or wrong-token contexts see nothing', async () => {
    const s = await sessionFor('user_member', ORG)
    const raw = async (token: string | null, user = 'user_member', org = ORG) => {
      await runtime.query('BEGIN')
      try {
        await runtime.query(`SELECT set_config('app.current_user_id',$1,true), set_config('app.current_org_id',$2,true), set_config('app.current_session_token',$3,true)`, [user, org, token ?? ''])
        return (await runtime.query(`SELECT user_id FROM user_management.ue_authority_membership_rows($1::uuid, ARRAY['user_president','user_member'])`, [ORG])).rows.length
      } finally { await runtime.query('ROLLBACK') }
    }
    expect(await raw(s.token)).toBe(2)
    expect(await raw('wrong-token')).toBe(0)
    expect(await raw(null)).toBe(0)
    expect(await raw(s.token, 'user_president')).toBe(0) // someone else's actor with this token
    await owner.query("UPDATE user_management.user_sessions SET created_at = now() - interval '2 minutes', expires_at = now() - interval '1 minute' WHERE session_id=$1", [s.session.sessionId])
    expect(await raw(s.token)).toBe(0)
    await owner.query('UPDATE user_management.user_sessions SET expires_at = now() + interval \'1 day\', is_active=false WHERE session_id=$1', [s.session.sessionId])
    expect(await raw(s.token)).toBe(0)
    await owner.query('UPDATE user_management.user_sessions SET is_active=true WHERE session_id=$1', [s.session.sessionId])
    expect(await raw(s.token)).toBe(2)
    // An actor whose membership was removed loses the view at once.
    await owner.query(`UPDATE user_management.organization_users SET is_active=false WHERE user_id='user_member' AND organization_id=$1`, [ORG])
    expect(await raw(s.token)).toBe(0)
    await owner.query(`UPDATE user_management.organization_users SET is_active=true WHERE user_id='user_member' AND organization_id=$1`, [ORG])
  })

  it('the definer grants nothing beyond itself: no direct table access, and only the runtime role may execute it', async () => {
    await expect(runtime.query('SELECT 1 FROM user_management.organization_users')).rejects.toThrow(/permission denied/)
    for (const c of [system, gateway]) {
      await expect(c.query(`SELECT * FROM user_management.ue_authority_membership_rows($1::uuid, ARRAY['x'])`, [ORG])).rejects.toThrow(/permission denied/)
    }
    const fn = await owner.query(`SELECT pg_get_userbyid(p.proowner) AS owner, p.prosecdef FROM pg_proc p WHERE p.proname='ue_authority_membership_rows'`)
    expect(fn.rows[0]).toEqual({ owner: AUTH_EXECUTION_ROLES.orgAuthorityReader, prosecdef: true })
  })

  it('the authority tables stay tenant-isolated under the runtime role in this topology', async () => {
    const s = await sessionFor('user_member', ORG)
    const inOrg = await bound(s.token, ORG, (t) => t.query(`SELECT 1 FROM ue_authority_mandates`))
    expect(inOrg.rows).toHaveLength(0)
    await expect(bound(s.token, ORG, (t) => t.query(`INSERT INTO ue_authority_recusals (organization_id, principal_user_id, resource_type, resource_id, reason) VALUES ($1,'user_member','case',$2,'x')`, [ORG_B, CASE]))).rejects.toThrow(/row-level security|AUDIT_LINK_MISSING|ACTOR_NOT_SESSION/)
  })
})

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import pg from 'pg'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { compileAuthBootstrapSql, AUTH_EXECUTION_ROLES, authContextSettings, authBusinessContextSettings } from './auth-sql'
import { compileSyntheticAuthFixtureSql } from './auth-fixture'
import { proveAuthExecutionBoundary, type AuthProofClients } from './auth-runtime'
import { closeAuthClients, executeAuthContext } from '../../../../packages/db/src/auth-client'
import { hashPassword } from '../../../../packages/platform-auth/src/password/password'
import { login, getAuthUser, signup, forgotPassword, resetPassword } from '../../../../packages/platform-auth/src/password/auth-service'
import { requestMagicLink, verifyMagicLink } from '../../../../packages/platform-auth/src/magic-link/service'
import { createInvite, acceptInvite } from '../../../../packages/platform-auth/src/invites/service'
import { enrollMfa, verifyEnrollment, consumeMfaChallenge, disableMfa } from '../../../../packages/platform-auth/src/mfa/service'
import { computeTotp } from '../../../../packages/platform-auth/src/mfa/totp'
import { resolveExternalAuthIdentity } from '../../../../packages/platform-auth/src/provider-identity'
import { suspendUser, reactivateUser, deprovisionUser } from '../../../../packages/platform-auth/src/lifecycle/service'
import { updateOrgAuthPolicy } from '../../../../packages/platform-auth/src/policy/admin'
import { validateSession, createSession } from '../../../../packages/platform-auth/src/password/session'
import { withAuthenticatedOrgBinding } from '../../../../packages/platform-auth/src/org-binding'
import { authDb, withAuthContext, withAuthSavepoint } from '../../../../packages/platform-auth/src/auth-db'
import { authenticateCoraAcceptanceIdentity, createCoraAcceptanceTrustProfile } from '../../../../packages/platform-auth/src/cora-acceptance-auth'
import { mintAcceptanceIdentityToken } from '../../../../packages/platform-auth/src/acceptance-trust'

const cookies = vi.hoisted(() => ({ token: '', actor: '', provider: '', set: vi.fn() }))
vi.mock('../../../../packages/platform-auth/src/entra/server', () => ({
  auth: async () => ({ userId: cookies.actor || null, orgId: null, identityProvider: cookies.provider || 'nzila-password' }),
}))
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => cookies.token ? { value: cookies.token } : undefined,
    set: cookies.set,
  }),
}))

describe('auth SQL compiler', () => {
  it('fails closed on context omissions and separates all principals', () => {
    const output = compileAuthBootstrapSql()
    expect(output).toContain('FORCE ROW LEVEL SECURITY')
    expect(output).not.toContain('BYPASSRLS;')
    expect(output).toContain('Existing auth policies require explicit reconciliation')
    expect(() => compileAuthBootstrapSql({ ordinaryRole: AUTH_EXECUTION_ROLES.gateway })).toThrow()
    expect(() => authContextSettings({ phase: 'lookup', selector: { kind: 'session', tokenHash: 'raw' } })).toThrow()
    expect(() => authContextSettings({
      phase: 'system', actorUserId: '', targetUserId: 'x', reason: '', operation: 'revoke-sessions',
    })).toThrow()
  })
})

const native = process.env.AUTH_NATIVE_PROOF === '1' ? describe : describe.skip
native('local native PostgreSQL auth execution boundary', () => {
  const image = 'pgvector/pgvector:0.8.1-pg16@sha256:33198da2828a14c30348d2ccb4750833d5ed9a44c88d840a0e523d7417120337'
  const name = `ue-auth-v2-${process.pid}-${Date.now()}`
  let created = false
  let clients: AuthProofClients
  const prior = {
    auth: process.env.AUTH_DATABASE_URL,
    system: process.env.AUTH_SYSTEM_DATABASE_URL,
    playwright: process.env.PLAYWRIGHT_TEST_AUTH,
    mfa: process.env.AUTH_MFA_ENCRYPTION_KEY,
  }
  beforeAll(async () => {
    execFileSync('docker', ['run', '--detach', '--name', name, '-e', 'POSTGRES_PASSWORD=synthetic-only',
      '-p', '127.0.0.1::5432', image], { stdio: 'pipe' })
    created = true
    const ports = JSON.parse(execFileSync('docker', ['inspect', '--format', '{{json .NetworkSettings.Ports}}', name], { encoding: 'utf8' }))
    const port = Number(ports['5432/tcp'][0].HostPort)
    const config = { host: '127.0.0.1', port, database: 'postgres', password: 'synthetic-only' }
    for (let attempt = 0; ; attempt++) {
      try {
        execFileSync(
          'docker',
          ['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'postgres'],
          { stdio: 'pipe' },
        )
        break
      } catch (error) {
        if (attempt >= 60) throw error
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
    const owner = new pg.Client({ ...config, user: 'postgres' })
    await owner.connect()
    // Keep a reference immediately so partial setup failures still clean up.
    clients = { owner } as AuthProofClients
    await owner.query(compileSyntheticAuthFixtureSql())
    await owner.query(`CREATE ROLE union_eyes_runtime LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD 'synthetic-only';
      CREATE ROLE union_eyes_system LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD 'synthetic-only';`)
    // Verify table REVOKE also closes pre-existing column-grant drift.
    await owner.query(`CREATE ROLE ${AUTH_EXECUTION_ROLES.identity} NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS;
      GRANT USAGE ON SCHEMA user_management TO union_eyes_runtime;
      GRANT SELECT, UPDATE (is_system_admin) ON user_management.users TO union_eyes_runtime;
      GRANT UPDATE (is_system_admin) ON user_management.users TO ${AUTH_EXECUTION_ROLES.identity};`)
    await owner.query(compileAuthBootstrapSql())
    await owner.query(`CREATE ROLE auth_proof_login LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS PASSWORD 'synthetic-only';
      CREATE ROLE auth_proof_system_login LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS PASSWORD 'synthetic-only';
      GRANT ${AUTH_EXECUTION_ROLES.gateway} TO auth_proof_login;
      GRANT ${AUTH_EXECUTION_ROLES.systemGateway} TO auth_proof_system_login;`)
    for (const [key, user] of [
      ['ordinary', 'union_eyes_runtime'], ['legacySystem', 'union_eyes_system'],
      ['auth', 'auth_proof_login'], ['authSystem', 'auth_proof_system_login'],
    ] as const) {
      const client = new pg.Client({ ...config, user })
      clients[key] = client
      await client.connect()
    }
    process.env.AUTH_DATABASE_URL = `postgres://auth_proof_login:synthetic-only@127.0.0.1:${port}/postgres`
    process.env.AUTH_SYSTEM_DATABASE_URL = `postgres://auth_proof_system_login:synthetic-only@127.0.0.1:${port}/postgres`
    delete process.env.PLAYWRIGHT_TEST_AUTH
    process.env.AUTH_MFA_ENCRYPTION_KEY = '11'.repeat(32)
  }, 120_000)
  afterAll(async () => {
    try {
      await closeAuthClients()
      if (clients) await Promise.all(Object.values(clients).map(client => client.end()))
    } finally {
      for (const [key, value] of [
        ['AUTH_DATABASE_URL', prior.auth], ['AUTH_SYSTEM_DATABASE_URL', prior.system],
        ['PLAYWRIGHT_TEST_AUTH', prior.playwright],
        ['AUTH_MFA_ENCRYPTION_KEY', prior.mfa],
      ] as const) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
      if (created) execFileSync('docker', ['rm', '--force', name], { stdio: 'pipe' })
    }
  })

  it('runs role/grant/RLS/token/system probes without claiming whole-contract PASS', async () => {
    const report = await proveAuthExecutionBoundary(clients)
    process.stdout.write(`${JSON.stringify(report)}\n`)
    expect(report.failures).toEqual([])
    expect(report.gaps).toEqual([])
    expect(report.passed).toEqual(expect.arrayContaining([...report.requiredPaths]))
    expect(report.passed).toHaveLength(21)
    expect(report.result).toBe('PASS')
    expect(report.orgBoundary?.passed).toHaveLength(33)
    expect(report.orgBoundary?.failures).toEqual([])
  })

  it('executes shared acceptance audit receipts without ordinary auth-table access', async () => {
    const env = { CORA_ACCEPTANCE_AUTH_ENABLED: 'true', CORA_ACCEPTANCE_AUTH_SECRET: 'synthetic-cora-acceptance-key-only-2026', NODE_ENV: 'test' }
    const token = await mintAcceptanceIdentityToken({ profile: createCoraAcceptanceTrustProfile(env), subject: 'synthetic-cora-subject' })
    expect(await authenticateCoraAcceptanceIdentity({ token, env, correlationId: 'native-cora-allow' })).not.toBeNull()
    expect(await authenticateCoraAcceptanceIdentity({ token: 'invalid-synthetic-token', env, correlationId: 'native-cora-deny' })).toBeNull()
    const { rows } = await clients.owner.query(`SELECT count(*)::int AS count FROM user_management.auth_audit_log
      WHERE metadata->>'correlationId' IN ('native-cora-allow','native-cora-deny') AND user_id IS NULL`)
    expect(rows[0].count).toBe(2)
  })

  it('installs the exact canonical provider-binding FK and rejects an orphan identity', async () => {
    const { rows } = await clients.owner.query(`SELECT conname,confdeltype,confupdtype FROM pg_constraint
      WHERE conrelid='public.platform_identity_bindings'::regclass AND contype='f'`)
    expect(rows).toEqual([{
      conname: 'platform_identity_bindings_platform_user_id_users_user_id_fk', confdeltype: 'r', confupdtype: 'a',
    }])
    await expect(clients.owner.query(`INSERT INTO public.platform_identity_bindings(provider,provider_subject,platform_user_id,verified_at,provisioned_by)
      VALUES ('entra','synthetic-orphan:object','synthetic-missing-user',now(),'synthetic-proof')`)).rejects.toMatchObject({ code: '23503' })
  })

  it('executes actual signup, reset issuance/redemption, magic issuance/rate/replay paths', async () => {
    const email = 'native-service@example.invalid'
    const password = 'Synthetic-service-only-2026!'
    const result = await signup({ email, password, ipAddress: '192.0.2.81' })
    expect(result.success).toBe(true)
    expect((await signup({ email, password })).success).toBe(false)
    await forgotPassword({ email, ipAddress: '192.0.2.81' })
    expect((await clients.owner.query('SELECT count(*)::int AS count FROM user_management.password_reset_tokens WHERE user_id=$1', [result.user!.id])).rows[0].count).toBe(1)
    const reset = 'synthetic-raw-reset-bearer'
    await clients.owner.query(`INSERT INTO user_management.password_reset_tokens(user_id,token_hash,expires_at)
      VALUES ($1,$2,now()+interval '1 hour')`, [result.user!.id, createHash('sha256').update(reset).digest('hex')])
    expect((await resetPassword({ token: reset, newPassword: password })).success).toBe(true)
    expect((await resetPassword({ token: reset, newPassword: password })).success).toBe(false)
    const link = await requestMagicLink({ email })
    expect(link.success).toBe(true)
    expect((await verifyMagicLink({ token: link.token! })).user?.id).toBe(result.user!.id)
    expect((await verifyMagicLink({ token: link.token! })).success).toBe(false)
    for (let i = 0; i < 4; i++) expect((await requestMagicLink({ email })).success).toBe(true)
    expect((await requestMagicLink({ email })).token).toBeUndefined()
    expect((await clients.owner.query('SELECT count(*)::int AS count FROM user_management.magic_links WHERE email=$1', [email])).rows[0].count).toBe(3)
  }, 30_000)

  it('executes actor-bound tenant invitation, policy update and inbox first-factor promotion', async () => {
    cookies.actor = 'auth-proof-a'
    await clients.owner.query(`UPDATE user_management.organization_users SET role='admin' WHERE user_id='auth-proof-a'`)
    const organizationId = '11111111-1111-4111-8111-111111111111'
    expect((await updateOrgAuthPolicy({ actorUserId: cookies.actor, organizationId, patch: { allowMagicLink: true } })).success).toBe(true)
    const invite = await createInvite({ email: 'native-invite@example.invalid', invitedBy: cookies.actor, organizationId, role: 'member' })
    expect(invite.success).toBe(true)
    const accepted = await acceptInvite({ token: invite.token! })
    expect(accepted.success).toBe(true)
    expect(accepted.user?.organizationId).toBe(organizationId)
    expect((await acceptInvite({ token: invite.token! })).success).toBe(false)
    await expect(createInvite({ email: 'forged@example.invalid', invitedBy: 'auth-proof-b', organizationId })).rejects.toThrow('actor')
    await clients.owner.query(`UPDATE user_management.organization_users SET role='member' WHERE user_id='auth-proof-a'`)
    cookies.actor = ''
  })

  it('executes real MFA enrollment, verification, alternate first-factor challenge, recovery and replay', async () => {
    const email = 'native-mfa@example.invalid'
    const first = await signup({ email, password: 'Synthetic-mfa-only-2026!' })
    cookies.actor = first.user!.id
    const enrollment = await enrollMfa({ userId: cookies.actor, userEmail: email })
    expect(enrollment.success).toBe(true)
    expect((await verifyEnrollment({ userId: cookies.actor, code: computeTotp(enrollment.secret!) })).success).toBe(true)
    const link = await requestMagicLink({ email })
    const cookieCount = cookies.set.mock.calls.length
    const challenge = await verifyMagicLink({ token: link.token! })
    expect(challenge.requiresMfa).toBe(true)
    expect(cookies.set.mock.calls).toHaveLength(cookieCount)
    const input = { challengeToken: challenge.challengeToken!, recoveryCode: enrollment.recoveryCodes![0] }
    expect((await consumeMfaChallenge(input)).success).toBe(true)
    expect((await consumeMfaChallenge(input)).success).toBe(false)
    const secondLink = await requestMagicLink({ email })
    const secondChallenge = await verifyMagicLink({ token: secondLink.token! })
    expect((await consumeMfaChallenge({ ...input, challengeToken: secondChallenge.challengeToken! })).success).toBe(false)
    const competing = await Promise.all([0, 1].map(() => consumeMfaChallenge({
      challengeToken: secondChallenge.challengeToken!, recoveryCode: enrollment.recoveryCodes![1],
    })))
    expect(competing.filter(result => result.success)).toHaveLength(1)
    const target = cookies.actor
    cookies.actor = 'auth-proof-b'
    expect((await disableMfa(target, cookies.actor)).success).toBe(false)
    await clients.owner.query("UPDATE user_management.users SET is_system_admin=true WHERE user_id='auth-proof-a'")
    cookies.actor = 'auth-proof-a'
    expect((await disableMfa(target, cookies.actor)).success).toBe(true)
    await clients.owner.query("UPDATE user_management.users SET is_system_admin=false WHERE user_id='auth-proof-a'")
    cookies.actor = target
    expect((await disableMfa(cookies.actor, cookies.actor)).success).toBe(true)
    cookies.actor = ''
  })

  it('executes canonical Entra mapping and authenticated lifecycle service mutations', async () => {
    await clients.owner.query(`INSERT INTO public.platform_identity_bindings(provider,provider_subject,platform_user_id,verified_at,provisioned_by)
      VALUES ('entra','native-tenant:native-object','auth-proof-b',now(),'synthetic-proof');
      UPDATE user_management.users SET is_system_admin=true WHERE user_id='auth-proof-a';`)
    expect((await resolveExternalAuthIdentity('entra', 'native-tenant:native-object'))?.platformUserId).toBe('auth-proof-b')
    expect(await resolveExternalAuthIdentity('entra', 'other-tenant:native-object')).toBeNull()
    cookies.actor = 'auth-proof-a'
    expect((await suspendUser('auth-proof-b', cookies.actor)).success).toBe(true)
    expect(await resolveExternalAuthIdentity('entra', 'native-tenant:native-object')).toBeNull()
    expect((await reactivateUser('auth-proof-b', cookies.actor)).success).toBe(true)
    expect((await deprovisionUser('auth-proof-b', cookies.actor)).success).toBe(true)
    expect((await reactivateUser('auth-proof-b', cookies.actor)).success).toBe(false)
    await clients.owner.query(`UPDATE user_management.users SET lifecycle_state='active',is_active=true,is_system_admin=false;
      UPDATE user_management.organization_users SET is_active=true;`)
    cookies.actor = ''
  })

  it('executes authenticated actor -> active membership -> PG session -> business authority', async () => {
    const orgA = '11111111-1111-4111-8111-111111111111'
    const orgB = '22222222-2222-4222-8222-222222222222'
    cookies.actor = 'auth-proof-a'
    const created = await withAuthContext({ phase: 'identity', userId: cookies.actor },
      () => createSession({ userId: cookies.actor, organizationId: orgA }))
    cookies.token = created.token
    const options = { expectedActorUserId: cookies.actor, organizationId: orgA, requiredRoles: ['member'] }
    await withAuthenticatedOrgBinding(options, async binding => {
      expect(binding.role).toBe('member')
      expect(binding.authority).toBe('pg-session')
      await clients.ordinary.query('BEGIN')
      try {
        for (const [key, value] of Object.entries(authBusinessContextSettings(binding)))
          await clients.ordinary.query('SELECT set_config($1,$2,true)', [key, value])
        expect((await clients.ordinary.query('SELECT user_management.auth_business_org_authorized($1::uuid) AS allowed', [orgA])).rows[0].allowed).toBe(true)
        await clients.ordinary.query("SELECT set_config('app.current_org_id',$1,true)", [orgB])
        expect((await clients.ordinary.query('SELECT user_management.auth_business_org_authorized($1::uuid) AS allowed', [orgB])).rows[0].allowed).toBe(false)
        await clients.ordinary.query("SELECT set_config('app.current_org_id',$1,true)", [orgA])
        await clients.owner.query('UPDATE user_management.user_sessions SET is_active=false WHERE session_id=$1', [created.session.sessionId])
        expect((await clients.ordinary.query('SELECT user_management.auth_business_org_authorized($1::uuid) AS allowed', [orgA])).rows[0].allowed).toBe(false)
      } finally {
        await clients.ordinary.query('ROLLBACK')
        await clients.owner.query('UPDATE user_management.user_sessions SET is_active=true WHERE session_id=$1', [created.session.sessionId])
      }
    })
    await expect(withAuthenticatedOrgBinding({ ...options, organizationId: orgB }, async () => undefined)).rejects.toMatchObject({ code: 'MEMBERSHIP_REQUIRED' })
    await expect(withAuthenticatedOrgBinding({ ...options, requiredRoles: ['admin'] }, async () => undefined)).rejects.toMatchObject({ code: 'ROLE_REQUIRED' })
    await expect(withAuthenticatedOrgBinding({ ...options, expectedActorUserId: 'auth-proof-b' }, async () => undefined)).rejects.toMatchObject({ code: 'ACTOR_MISMATCH' })
    try {
      await clients.owner.query('UPDATE user_management.organization_users SET is_active=false WHERE user_id=$1', [cookies.actor])
      await expect(withAuthenticatedOrgBinding(options, async () => undefined)).rejects.toMatchObject({ code: 'MEMBERSHIP_REQUIRED' })
    } finally { await clients.owner.query('UPDATE user_management.organization_users SET is_active=true WHERE user_id=$1', [cookies.actor]) }
    await clients.owner.query('UPDATE user_management.user_sessions SET is_active=false WHERE session_id=$1', [created.session.sessionId])
    await expect(withAuthenticatedOrgBinding(options, async () => undefined)).rejects.toMatchObject({ code: 'SESSION_AUTHORITY_REQUIRED' })
    cookies.token = ''
    cookies.actor = ''
  })

  it('creates a short-lived canonical bridge only after provider authentication and revokes it on callback failure', async () => {
    const organizationId = '11111111-1111-4111-8111-111111111111'
    cookies.actor = 'auth-proof-a'
    cookies.provider = 'entra'
    let hash = ''
    try {
      await expect(withAuthenticatedOrgBinding({ organizationId, requiredRoles: ['member'] }, async binding => {
        expect(binding.authority).toBe('verified-provider-bridge')
        expect(binding.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(30_000)
        hash = createHash('sha256').update(binding.sessionToken).digest('hex')
        await clients.ordinary.query('BEGIN')
        try {
          for (const [key, value] of Object.entries(authBusinessContextSettings(binding)))
            await clients.ordinary.query('SELECT set_config($1,$2,true)', [key, value])
          expect((await clients.ordinary.query('SELECT user_management.auth_business_org_authorized($1::uuid) AS allowed', [organizationId])).rows[0].allowed).toBe(true)
        } finally { await clients.ordinary.query('ROLLBACK') }
        throw new Error('Synthetic callback failure')
      })).rejects.toThrow('Synthetic callback failure')
      expect((await clients.owner.query('SELECT is_active FROM user_management.user_sessions WHERE session_token_hash=$1', [hash])).rows[0].is_active).toBe(false)
    } finally {
      cookies.provider = ''
      cookies.actor = ''
    }
  })

  it('surfaces real bridge revocation failures without losing the primary callback error or disclosing its bearer', async () => {
    const organizationId = '11111111-1111-4111-8111-111111111111'
    cookies.actor = 'auth-proof-a'
    cookies.provider = 'entra'
    const hashes: string[] = []
    try {
      await clients.owner.query(`CREATE FUNCTION public.auth_proof_revoke_failure() RETURNS trigger
        LANGUAGE plpgsql SET search_path=pg_catalog AS $proof$
        BEGIN RAISE EXCEPTION 'Synthetic bridge revocation failure'; END $proof$;
        CREATE TRIGGER auth_proof_revoke_failure BEFORE UPDATE ON user_management.user_sessions
          FOR EACH ROW WHEN (OLD.user_id='auth-proof-a' AND NEW.is_active=false)
          EXECUTE FUNCTION public.auth_proof_revoke_failure();`)
      const primary = new Error('Synthetic primary callback failure')
      for (const failCallback of [true, false]) {
        let bearer = ''
        let failure: unknown
        try {
          await withAuthenticatedOrgBinding({ organizationId }, async binding => {
            bearer = binding.sessionToken
            hashes.push(createHash('sha256').update(bearer).digest('hex'))
            if (failCallback) throw primary
            return 'successful callback'
          })
        } catch (error) { failure = error }
        expect(failure).toBeInstanceOf(Error)
        const cleanup = failCallback ? (failure as AggregateError).errors[1] : failure
        if (failCallback) {
          expect(failure).toBeInstanceOf(AggregateError)
          expect((failure as AggregateError).errors).toHaveLength(2)
          expect((failure as AggregateError).errors[0]).toBe(primary)
          expect((failure as AggregateError).cause).toBe(primary)
        }
        expect(String((cleanup as Error).cause)).toContain('Synthetic bridge revocation failure')
        expect(`${(failure as Error).message} ${(failure as Error).stack} ${(cleanup as Error).message}`).not.toContain(bearer)
        expect((await clients.owner.query('SELECT is_active FROM user_management.user_sessions WHERE session_token_hash=$1',
          [hashes.at(-1)])).rows[0].is_active).toBe(true)
      }
    } finally {
      await clients.owner.query(`DROP TRIGGER IF EXISTS auth_proof_revoke_failure ON user_management.user_sessions;
        DROP FUNCTION IF EXISTS public.auth_proof_revoke_failure();`)
      if (hashes.length) await clients.owner.query(
        'UPDATE user_management.user_sessions SET is_active=false WHERE session_token_hash=ANY($1)', [hashes])
      cookies.provider = ''
      cookies.actor = ''
    }
  })

  it('runs actual password validation -> shared executor -> cookie/session -> own identity', async () => {
    cookies.set.mockClear()
    const password = 'Synthetic-proof-only-2026!'
    const hash = await hashPassword(password)
    await clients.owner.query("UPDATE user_management.users SET password_hash=$1 WHERE user_id='auth-proof-a'", [hash])
    const rejected = await login({ email: 'auth-proof-a@example.invalid', password: 'wrong' })
    expect(rejected).toEqual({ success: false, error: 'Invalid email or password' })
    expect(cookies.set).not.toHaveBeenCalled()
    const result = await login({ email: 'auth-proof-a@example.invalid', password })
    expect(result.success).toBe(true)
    expect(result.user?.id).toBe('auth-proof-a')
    const cookie = cookies.set.mock.calls[0]
    expect(cookie[0]).toBe('nzila_session')
    cookies.token = cookie[1]
    expect((await validateSession(cookies.token))?.userId).toBe('auth-proof-a')
    expect(await validateSession('not-a-valid-session')).toBeNull()
    expect((await getAuthUser())?.id).toBe('auth-proof-a')
    const stored = await clients.owner.query('SELECT session_token_hash FROM user_management.user_sessions WHERE session_token_hash=$1',
      [createHash('sha256').update(cookies.token).digest('hex')])
    expect(stored.rowCount).toBe(1)
    expect(stored.rows[0].session_token_hash).not.toBe(cookies.token)
  })

  it('shared executor rolls back, clears GUCs, and uses the explicitly separate system credential', async () => {
    await expect(executeAuthContext({ phase: 'identity', userId: 'auth-proof-a' }, async executor => {
      await executor.execute(sql`UPDATE user_management.users SET first_name='not-granted'`)
    })).rejects.toMatchObject({ cause: { code: '42501' } })
    const own = await executeAuthContext({ phase: 'identity', userId: 'auth-proof-b' },
      executor => executor.execute(sql`SELECT user_id FROM user_management.users`))
    expect(own.map(row => row.user_id)).toEqual(['auth-proof-b'])
    const before = await clients.owner.query("SELECT session_id,is_active FROM user_management.user_sessions WHERE user_id='auth-proof-a' ORDER BY session_id")
    await executeAuthContext({
      phase: 'system', actorUserId: 'synthetic-platform-admin', targetUserId: 'auth-proof-b',
      operation: 'revoke-sessions', reason: 'Explicit synthetic authorization',
    }, executor => executor.execute(sql`UPDATE user_management.user_sessions SET is_active=false`))
    const untouched = await clients.owner.query("SELECT session_id,is_active FROM user_management.user_sessions WHERE user_id='auth-proof-a' ORDER BY session_id")
    expect(untouched.rows).toEqual(before.rows)
  })

  it('promotes concurrent logins without holding lookup connections across the pool boundary', async () => {
    const outcomes = await Promise.all(Array.from({ length: 6 }, () =>
      login({ email: 'auth-proof-a@example.invalid', password: 'Synthetic-proof-only-2026!' })))
    expect(outcomes.every(outcome => outcome.success && outcome.user?.id === 'auth-proof-a')).toBe(true)
  }, 30_000)

  it('rechecks active identity and organization authority when inserting a session', async () => {
    const mint = (organizationId: string | null) =>
      executeAuthContext({ phase: 'identity', userId: 'auth-proof-a' }, executor =>
        executor.execute(sql`INSERT INTO user_management.user_sessions
          (user_id, session_token_hash, expires_at, organization_id)
          VALUES ('auth-proof-a', 'synthetic-denied-mint', now()+interval '1 hour', ${organizationId})`))
    await expect(mint('00000000-0000-4000-8000-000000000099'))
      .rejects.toMatchObject({ cause: { code: '42501' } })
    await clients.owner.query("UPDATE user_management.users SET lifecycle_state='suspended' WHERE user_id='auth-proof-a'")
    try {
      await expect(mint(null)).rejects.toMatchObject({ cause: { code: '42501' } })
    } finally {
      await clients.owner.query("UPDATE user_management.users SET lifecycle_state='active' WHERE user_id='auth-proof-a'")
    }
  })

  it('requires MFA after first-factor validation and creates only a challenge, not a session', async () => {
    const before = await clients.owner.query("SELECT count(*)::int AS count FROM user_management.user_sessions WHERE user_id='auth-proof-a'")
    await clients.owner.query(`INSERT INTO user_management.mfa_totp(user_id,secret_encrypted,enabled_at)
      VALUES ('auth-proof-a','synthetic-not-used-for-decryption',now())`)
    cookies.set.mockClear()
    const result = await login({ email: 'auth-proof-a@example.invalid', password: 'Synthetic-proof-only-2026!' })
    expect(result.success).toBe(true)
    expect(result.requiresMfa).toBe(true)
    expect(result.mfaChallengeToken).toBeTruthy()
    expect(cookies.set).not.toHaveBeenCalled()
    const after = await clients.owner.query("SELECT count(*)::int AS count FROM user_management.user_sessions WHERE user_id='auth-proof-a'")
    expect(after.rows[0].count).toBe(before.rows[0].count)
    const challenge = await clients.owner.query('SELECT user_id FROM user_management.mfa_challenges WHERE token_hash=$1',
      [createHash('sha256').update(result.mfaChallengeToken!).digest('hex')])
    expect(challenge.rows).toEqual([{ user_id: 'auth-proof-a' }])
  })

  it('does not fall back to ordinary or legacy system clients when auth configuration/context is absent', async () => {
    expect(() => authDb.select()).toThrow('Auth execution context required')
    const saved = process.env.AUTH_DATABASE_URL
    delete process.env.AUTH_DATABASE_URL
    try {
      await expect(executeAuthContext({ phase: 'identity', userId: 'auth-proof-a' },
        executor => executor.execute(sql`SELECT 1`))).rejects.toThrow('AUTH_DATABASE_URL is required')
    } finally {
      process.env.AUTH_DATABASE_URL = saved
    }
  })

  it('preserves cross-account IP risk aggregates without granting cross-user audit rows', async () => {
    await clients.owner.query(`INSERT INTO user_management.auth_audit_log(user_id,event_type,ip_address)
      VALUES ('auth-proof-a','login_failed','192.0.2.19'),
             ('auth-proof-b','login_failed','192.0.2.19'),
             ('auth-proof-b','login_failed','192.0.2.20')`)
    await withAuthContext({ phase: 'identity', userId: 'auth-proof-a' }, async () => {
      const [count] = await authDb.execute(sql`SELECT user_management.auth_failed_login_count(
        '192.0.2.19', now()-interval '15 minutes') AS count`)
      expect(Number(count.count)).toBe(2)
      const rows = await authDb.execute(sql`SELECT DISTINCT user_id FROM user_management.auth_audit_log`)
      expect(rows.map(row => row.user_id)).toEqual(['auth-proof-a'])
      await expect(withAuthSavepoint(async () => {
        await authDb.execute(sql`INSERT INTO user_management.auth_audit_log(user_id,event_type)
          VALUES ('auth-proof-b','forged')`)
      })).rejects.toMatchObject({ cause: { code: '42501' } })
      // The failed best-effort write did not abort the surrounding transaction.
      const [live] = await authDb.execute(sql`SELECT 1 AS live`)
      expect(live.live).toBe(1)
    })
    await expect(clients.ordinary.query(`SELECT user_management.auth_failed_login_count(
      '192.0.2.19',now()-interval '15 minutes')`)).rejects.toMatchObject({ code: '42501' })
  })
})

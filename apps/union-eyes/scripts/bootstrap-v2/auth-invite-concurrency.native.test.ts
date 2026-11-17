/**
 * READY_FOR_VS_EXECUTION. Cursor does not start Docker and does not run this suite.
 *
 * VS Code command, from a disposable local PostgreSQL that this file bootstraps:
 *   UE_AUTH_CONCURRENCY_PROOF=1 UE_AUTH_OWNER_URL=postgres://postgres:synthetic-only@127.0.0.1:<port>/postgres \
 *     pnpm exec vitest run apps/union-eyes/scripts/bootstrap-v2/auth-invite-concurrency.native.test.ts
 *
 * The owner URL must be a superuser on an empty database. The suite installs the
 * synthetic auth fixture and compileAuthBootstrapSql(), then opens the redemption
 * gateway roles itself. It does not call docker.
 *
 * Orderings covered: offboarding or membership removal commits while redemption
 * waits; redemption commits while offboarding waits, then only still-pending
 * invitations are revoked. Rollback releases the lock. Replay, reactivation and
 * a foreign organization are separate cases.
 *
 * Failure means the lock, the revoke trigger, or the redemption re-read did not
 * serialize. Recovery is to drop that disposable database. Do not point this URL
 * at a shared or production database: bootstrap refuses existing auth policies,
 * and the suite writes synthetic identities.
 */
import { createHash } from 'node:crypto'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { closeAuthClients } from '../../../../packages/db/src/auth-client'
import { acceptInvite, createInvite, canManageOrganizationInvites, listOrganizationInvites, reissueInvite, revokeInvite } from '../../../../packages/platform-auth/src/invites/service'
import { AUTH_EXECUTION_ROLES, compileAuthBootstrapSql } from './auth-sql'
import { compileSyntheticAuthFixtureSql } from './auth-fixture'
import { withAuthContext } from '../../../../packages/platform-auth/src/auth-db'
import { AUTH_EMAIL_PATTERN, compileAuthEmailCompatibilityUpgradeSql, LEGACY_AUTH_EMAIL_PATTERN, authEmailSqlLiteral } from '../../../../packages/db/src/auth-email-check'
import { handleAcceptInvite } from '../../../../packages/platform-auth/src/invites/handlers'
import { NextRequest } from 'next/server'

const cookies = vi.hoisted(() => ({ token: '', actor: '', provider: '', set: vi.fn() }))
vi.mock('../../../../packages/platform-auth/src/entra/server', () => ({
  auth: async () => ({ userId: cookies.actor || null, orgId: null, identityProvider: 'nzila-password' }),
}))
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => cookies.token ? { value: cookies.token } : undefined,
    set: cookies.set,
  }),
}))

const enabled = process.env.UE_AUTH_CONCURRENCY_PROOF === '1'
const orgA = '11111111-1111-4111-8111-111111111111'
const orgB = '22222222-2222-4222-8222-222222222222'
const inviter = 'concurrency-inviter'

describe.skipIf(!enabled)('invitation redemption concurrency against disposable PostgreSQL', () => {
  const ownerUrl = process.env.UE_AUTH_OWNER_URL
  let owner: pg.Client
  let peer: pg.Client
  const prior = {
    auth: process.env.AUTH_DATABASE_URL,
    system: process.env.AUTH_SYSTEM_DATABASE_URL,
  }

  beforeAll(async () => {
    if (!ownerUrl) throw new Error('UE_AUTH_OWNER_URL is required for UE_AUTH_CONCURRENCY_PROOF')
    owner = new pg.Client({ connectionString: ownerUrl })
    peer = new pg.Client({ connectionString: ownerUrl })
    await owner.connect()
    await peer.connect()
    await owner.query(compileSyntheticAuthFixtureSql())
    await owner.query('CREATE ROLE union_eyes_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS; CREATE ROLE union_eyes_system NOLOGIN NOSUPERUSER NOBYPASSRLS;')
    await owner.query(compileAuthBootstrapSql())
    await owner.query(`CREATE ROLE auth_concurrency_login LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS PASSWORD 'synthetic-only';
      CREATE ROLE auth_concurrency_system_login LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS PASSWORD 'synthetic-only';
      GRANT ${AUTH_EXECUTION_ROLES.gateway} TO auth_concurrency_login;
      GRANT ${AUTH_EXECUTION_ROLES.systemGateway} TO auth_concurrency_system_login;`)
    const parsed = new URL(ownerUrl)
    const authUrl = `postgres://auth_concurrency_login:synthetic-only@${parsed.hostname}:${parsed.port || 5432}${parsed.pathname}`
    const systemUrl = `postgres://auth_concurrency_system_login:synthetic-only@${parsed.hostname}:${parsed.port || 5432}${parsed.pathname}`
    process.env.AUTH_DATABASE_URL = authUrl
    process.env.AUTH_SYSTEM_DATABASE_URL = systemUrl
    await owner.query(`INSERT INTO user_management.users(user_id,email,password_hash,is_active,lifecycle_state)
      VALUES ($1,$2,'synthetic-hash',true,'active')`, [inviter, 'concurrency-inviter@example.invalid'])
    await owner.query(`INSERT INTO user_management.organization_users(user_id,organization_id,role,is_active)
      VALUES ($1,$2,'admin',true)`, [inviter, orgA])
  }, 120_000)

  afterAll(async () => {
    await closeAuthClients().catch(() => undefined)
    await peer?.end().catch(() => undefined)
    await owner?.end().catch(() => undefined)
    if (prior.auth === undefined) delete process.env.AUTH_DATABASE_URL
    else process.env.AUTH_DATABASE_URL = prior.auth
    if (prior.system === undefined) delete process.env.AUTH_SYSTEM_DATABASE_URL
    else process.env.AUTH_SYSTEM_DATABASE_URL = prior.system
  })

  async function issue(email: string, organizationId = orgA): Promise<string> {
    const token = `concurrency-${email}`
    await owner.query(`INSERT INTO user_management.invites(email,organization_id,role,token_hash,invited_by,expires_at)
      VALUES ($1,$2,'member',$3,$4,now()+interval '1 day')`,
    [email, organizationId, createHash('sha256').update(token).digest('hex'), inviter])
    return token
  }

  async function revoked(email: string): Promise<boolean> {
    const row = (await owner.query(`SELECT revoked_at IS NOT NULL AS revoked FROM user_management.invites WHERE email=$1`, [email])).rows[0]
    return row?.revoked === true
  }

  async function acceptForm(token: string) {
    return handleAcceptInvite(new NextRequest('https://synthetic.invalid/api/auth/accept-invite', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, firstName: 'Synthetic', lastName: 'Invite' }),
    }))
  }

  async function acceptanceState(email: string) {
    return (await owner.query(`SELECT
      (SELECT count(*)::int FROM user_management.users WHERE email=$1) users,
      (SELECT count(*)::int FROM user_management.organization_users WHERE user_id IN
        (SELECT user_id FROM user_management.users WHERE email=$1)) memberships,
      (SELECT count(*)::int FROM user_management.user_sessions WHERE user_id IN
        (SELECT user_id FROM user_management.users WHERE email=$1)) sessions,
      (SELECT count(*)::int FROM user_management.auth_audit_log WHERE event_type='invite_accepted'
        AND metadata->>'inviteId' IN (SELECT id::text FROM user_management.invites WHERE email=$1)) audits,
      (SELECT accepted_at IS NOT NULL AND accepted_user_id IS NOT NULL FROM user_management.invites WHERE email=$1) accepted`, [email])).rows[0]
  }

  it('reproduces legacy form failure, upgrades only the check, then accepts the original tagged invitation once', async () => {
    const email = 'original+tag@example.invalid'
    const token = await issue(email)
    await owner.query(`ALTER TABLE user_management.users DROP CONSTRAINT valid_email,
      ADD CONSTRAINT valid_email CHECK (email ~* ${authEmailSqlLiteral(LEGACY_AUTH_EMAIL_PATTERN)})`)
    const snapshot = async () => (await owner.query(`SELECT c.oid,c.relfilenode,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity,
      (SELECT jsonb_agg(to_jsonb(u) ORDER BY user_id) FROM user_management.users u) users,
      (SELECT jsonb_agg(to_jsonb(p) ORDER BY policyname) FROM pg_policies p WHERE schemaname='user_management') policies
      FROM pg_class c WHERE c.oid='user_management.users'::regclass`)).rows[0]
    const before = await snapshot()
    expect((await acceptForm(token)).status).toBe(500)
    expect(await acceptanceState(email)).toEqual({ users: 0, memberships: 0, sessions: 0, audits: 0, accepted: false })
    // This transaction is disposable local PostgreSQL; rollback must restore
    // the legacy constraint. The independently committed retry is deliberate.
    await owner.query('BEGIN; SET LOCAL lock_timeout=\'5s\'; SET LOCAL statement_timeout=\'30s\'')
    await owner.query(compileAuthEmailCompatibilityUpgradeSql())
    expect(await snapshot()).toEqual(before)
    await owner.query('ROLLBACK')
    expect((await acceptForm(token)).status).toBe(500)
    await owner.query('BEGIN; SET LOCAL lock_timeout=\'5s\'; SET LOCAL statement_timeout=\'30s\'')
    await owner.query(compileAuthEmailCompatibilityUpgradeSql())
    await owner.query('COMMIT')
    expect(await snapshot()).toEqual(before)
    const constraint = async () => (await owner.query(`SELECT oid,pg_get_constraintdef(oid) definition FROM pg_constraint
      WHERE conrelid='user_management.users'::regclass AND conname='valid_email'`)).rows[0]
    const upgraded = await constraint()
    await owner.query(compileAuthEmailCompatibilityUpgradeSql())
    expect(await constraint()).toEqual(upgraded)
    expect((await acceptForm(token)).status).toBe(200)
    expect(await acceptanceState(email)).toEqual({ users: 1, memberships: 1, sessions: 1, audits: 1, accepted: true })
    expect((await acceptForm(token)).status).toBe(400)
    expect(await acceptanceState(email)).toEqual({ users: 1, memberships: 1, sessions: 1, audits: 1, accepted: true })
  })

  it('refuses unknown, absent, unvalidated and conflicting upgrade states without changing them', async () => {
    for (const mutation of [
      'ALTER TABLE user_management.users DROP CONSTRAINT valid_email',
      'ALTER TABLE user_management.users DROP CONSTRAINT valid_email, ADD CONSTRAINT valid_email CHECK (email IS NOT NULL)',
      `ALTER TABLE user_management.users DROP CONSTRAINT valid_email, ADD CONSTRAINT valid_email CHECK (email ~* ${authEmailSqlLiteral(AUTH_EMAIL_PATTERN)}) NOT VALID`,
      'ALTER TABLE user_management.users ADD CONSTRAINT valid_email_compatibility CHECK (email IS NOT NULL)',
    ]) {
      await owner.query('BEGIN')
      try {
        await owner.query(mutation)
        await expect(owner.query(compileAuthEmailCompatibilityUpgradeSql())).rejects.toMatchObject({ code: 'P0001' })
      } finally { await owner.query('ROLLBACK') }
    }
  })

  it('rolls back new apostrophe/tagged account, membership, session and token consumption when mandatory audit fails, then retries', async () => {
    const email = "o'brien+retry@example.invalid"
    const token = await issue(email)
    await owner.query(`CREATE FUNCTION user_management.test_refuse_accept_audit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.event_type='invite_accepted' THEN RAISE EXCEPTION 'synthetic acceptance audit failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER test_refuse_accept_audit BEFORE INSERT ON user_management.auth_audit_log
      FOR EACH ROW EXECUTE FUNCTION user_management.test_refuse_accept_audit()`)
    try {
      expect((await acceptForm(token)).status).toBe(500)
      expect(await acceptanceState(email)).toEqual({ users: 0, memberships: 0, sessions: 0, audits: 0, accepted: false })
    } finally {
      await owner.query('DROP TRIGGER test_refuse_accept_audit ON user_management.auth_audit_log; DROP FUNCTION user_management.test_refuse_accept_audit()')
    }
    expect((await acceptForm(token)).status).toBe(200)
    expect(await acceptanceState(email)).toEqual({ users: 1, memberships: 1, sessions: 1, audits: 1, accepted: true })
  })

  it('serializes simultaneous redemption of a new tagged address without duplicate accounts or sessions', async () => {
    const email = 'concurrent+tag@example.invalid'
    const token = await issue(email)
    const responses = await Promise.all([acceptForm(token), acceptForm(token)])
    expect(responses.map(response => response.status).sort()).toEqual([200, 400])
    expect(await acceptanceState(email)).toEqual({ users: 1, memberships: 1, sessions: 1, audits: 1, accepted: true })
  })

  it.each(['suspension', 'membership removal'])('refuses invitation issuance when %s commits during the request', async (change) => {
    await restoreInviter()
    cookies.actor = inviter
    const email = change === 'suspension' ? 'issuance-suspension@example.invalid' : 'issuance-membership-removal@example.invalid'
    await peer.query('BEGIN')
    try {
      if (change === 'suspension')
        await peer.query(`UPDATE user_management.users SET lifecycle_state='suspended', is_active=false WHERE user_id=$1`, [inviter])
      else
        await peer.query('UPDATE user_management.organization_users SET is_active=false WHERE user_id=$1 AND organization_id=$2', [inviter, orgA])
      const creation = createInvite({ email, organizationId: orgA, invitedBy: inviter }).then(
        value => ({ value, error: null }), error => ({ value: null, error }),
      )
      await new Promise(resolve => setTimeout(resolve, 200))
      await peer.query('COMMIT')
      const result = await creation
      expect(result.error).toMatchObject({ code: 'AUTH_TENANT_ADMIN_REQUIRED' })
      expect(result.value).toBeNull()
      expect((await owner.query('SELECT count(*)::int n FROM user_management.invites WHERE email=$1', [email])).rows[0].n).toBe(0)
    } finally {
      await peer.query('ROLLBACK')
      await restoreInviter()
      cookies.actor = ''
    }
  })

  it('issues, lists, rotates and revokes real hashed invitations without exposing either credential', async () => {
    await restoreInviter()
    cookies.actor = inviter
    expect(await canManageOrganizationInvites(inviter, orgA)).toBe(true)
    expect(await canManageOrganizationInvites(inviter, orgB)).toBe(false)
    const first = await createInvite({ email: 'managed-new@example.invalid', role: 'member', organizationId: orgA, invitedBy: inviter })
    expect(first.success).toBe(true)
    const rows = await listOrganizationInvites(inviter, orgA)
    expect(rows.find(row => row.id === first.inviteId)).toMatchObject({ email: 'managed-new@example.invalid', role: 'member' })
    expect(JSON.stringify(rows)).not.toContain(first.token)
    expect(JSON.stringify(rows)).not.toContain('tokenHash')
    await expect(reissueInvite({ inviteId: first.inviteId!, organizationId: orgB, actorUserId: inviter })).rejects.toThrow()
    const second = await reissueInvite({ inviteId: first.inviteId!, organizationId: orgA, actorUserId: inviter })
    expect(second.success).toBe(true)
    expect(second.token).not.toBe(first.token)
    expect((await acceptInvite({ token: first.token! })).success).toBe(false)
    const accepted = await acceptInvite({ token: second.token! })
    expect(accepted.user).toMatchObject({ email: 'managed-new@example.invalid', organizationId: orgA, role: 'member' })
    expect((await acceptInvite({ token: second.token! })).success).toBe(false)
    expect((await revokeInvite({ inviteId: second.inviteId!, organizationId: orgA, actorUserId: inviter })).success).toBe(false)
    const third = await createInvite({ email: 'managed-revoke@example.invalid', organizationId: orgA, invitedBy: inviter })
    expect((await revokeInvite({ inviteId: third.inviteId!, organizationId: orgA, actorUserId: inviter })).success).toBe(true)
    expect((await acceptInvite({ token: third.token! })).success).toBe(false)
    const events = (await owner.query(`SELECT event_type FROM user_management.auth_audit_log WHERE metadata->>'inviteId'=$1`, [first.inviteId])).rows
    expect(events.map(row => row.event_type)).toEqual(expect.arrayContaining(['invite_created', 'invite_reissued']))
    cookies.actor = ''
  })

  it('allows only one replacement under concurrent reissue and rolls back rotation when required audit fails', async () => {
    await restoreInviter()
    // Establish two independent tenant execution scopes; the database, not a mocked query builder,
    // serializes the race. The preceding case exercises authenticated actor promotion separately.
    const tenant = <T,>(op: () => Promise<T>) => withAuthContext({ phase: 'tenant-admin', userId: inviter, organizationId: orgA }, op)
    const created = await Promise.all([0, 1].map(() => tenant(() => createInvite({ email: 'managed-race@example.invalid', organizationId: orgA, invitedBy: inviter }))))
    expect(created.filter(result => result.success)).toHaveLength(1)
    const first = created.find(result => result.success)!
    const input = { inviteId: first.inviteId!, organizationId: orgA, actorUserId: inviter }
    const replacements = await Promise.all([tenant(() => reissueInvite(input)), tenant(() => reissueInvite(input))])
    expect(replacements.filter(result => result.success)).toHaveLength(1)
    const replacement = replacements.find(result => result.success)!
    await owner.query(`CREATE FUNCTION user_management.test_refuse_invite_audit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.event_type='invite_reissued' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER test_refuse_invite_audit BEFORE INSERT ON user_management.auth_audit_log
      FOR EACH ROW EXECUTE FUNCTION user_management.test_refuse_invite_audit();`)
    try {
      await expect(tenant(() => reissueInvite({ ...input, inviteId: replacement.inviteId! }))).rejects.toMatchObject({ cause: { message: 'synthetic audit failure' } })
      const row = (await owner.query('SELECT revoked_at FROM user_management.invites WHERE id=$1', [replacement.inviteId])).rows[0]
      expect(row.revoked_at).toBeNull()
    } finally {
      await owner.query('DROP TRIGGER test_refuse_invite_audit ON user_management.auth_audit_log; DROP FUNCTION user_management.test_refuse_invite_audit()')
    }
    expect((await acceptInvite({ token: replacement.token! })).success).toBe(true)
    cookies.actor = ''
  })

  it('an offboarding that commits first leaves the redemption with nothing', async () => {
    const token = await issue('concurrency-offboard-first@example.invalid')
    await peer.query('BEGIN')
    await peer.query(`UPDATE user_management.users SET lifecycle_state='suspended', is_active=false WHERE user_id=$1`, [inviter])
    const accepted = acceptInvite({ token })
    await new Promise(resolve => setTimeout(resolve, 200))
    await peer.query('COMMIT')
    await expect(accepted).resolves.toEqual({ success: false, error: 'Invalid or expired invite' })
    expect(await revoked('concurrency-offboard-first@example.invalid')).toBe(true)
    expect((await owner.query(`SELECT count(*)::int AS n FROM user_management.users WHERE email=$1`, ['concurrency-offboard-first@example.invalid'])).rows[0].n).toBe(0)
  }, 30_000)

  it('releases the inviter lock on rollback and then lets a still-live inviter redeem', async () => {
    await owner.query(`UPDATE user_management.users SET lifecycle_state='active', is_active=true WHERE user_id=$1`, [inviter])
    const token = await issue('concurrency-rollback@example.invalid')
    await peer.query('BEGIN')
    await peer.query(`UPDATE user_management.users SET lifecycle_state='suspended', is_active=false WHERE user_id=$1`, [inviter])
    await peer.query('ROLLBACK')
    expect(await revoked('concurrency-rollback@example.invalid')).toBe(false)
    const accepted = await acceptInvite({ token })
    expect(accepted.success).toBe(true)
    expect(accepted.user?.organizationId).toBe(orgA)
    expect((await acceptInvite({ token })).success).toBe(false)
  }, 30_000)

  it('blocks a second offboarding while the inviter lock is held, then proceeds after release', async () => {
    await peer.query('BEGIN')
    await peer.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`auth-inviter:${inviter}`])
    const blocked = owner.query(`UPDATE user_management.users SET lifecycle_state='suspended', is_active=false WHERE user_id=$1`, [inviter])
    const rejection = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('offboarding did not wait for the inviter lock')), 3000)
      blocked.then(() => {
        clearTimeout(timer)
        resolve('committed')
      }, (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      })
    })
    await expect(Promise.race([
      rejection,
      new Promise(resolve => setTimeout(() => resolve('waiting'), 500)),
    ])).resolves.toBe('waiting')
    await peer.query('ROLLBACK')
    await expect(rejection).resolves.toBe('committed')
  }, 30_000)

  it('does not revive a revoked invitation when the inviter is reactivated', async () => {
    await owner.query(`UPDATE user_management.users SET lifecycle_state='active', is_active=true WHERE user_id=$1`, [inviter])
    const token = await issue('concurrency-revived@example.invalid')
    await owner.query(`UPDATE user_management.users SET lifecycle_state='suspended', is_active=false WHERE user_id=$1`, [inviter])
    expect(await revoked('concurrency-revived@example.invalid')).toBe(true)
    await owner.query(`UPDATE user_management.users SET lifecycle_state='active', is_active=true WHERE user_id=$1`, [inviter])
    expect(await revoked('concurrency-revived@example.invalid')).toBe(true)
    expect((await acceptInvite({ token })).success).toBe(false)
  }, 30_000)

  it('keeps a foreign organization out of a redeemed membership', async () => {
    const foreign = await issue('concurrency-foreign@example.invalid', orgB)
    expect((await acceptInvite({ token: foreign })).success).toBe(false)
    const local = await issue('concurrency-local@example.invalid', orgA)
    const accepted = await acceptInvite({ token: local })
    expect(accepted.success).toBe(true)
    const rows = (await owner.query(`SELECT m.organization_id FROM user_management.organization_users m
      JOIN user_management.users u ON u.user_id=m.user_id WHERE u.email=$1`, ['concurrency-local@example.invalid'])).rows
    expect(rows).toEqual([{ organization_id: orgA }])
  }, 30_000)

  async function restoreInviter(): Promise<void> {
    await owner.query(`UPDATE user_management.users SET lifecycle_state='active', is_active=true WHERE user_id=$1`, [inviter])
    await owner.query(`UPDATE user_management.organization_users SET role='admin', is_active=true WHERE user_id=$1 AND organization_id=$2`, [inviter, orgA])
  }

  function lockTimeout(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '55P03'
  }

  it('a membership removal that commits first leaves the redemption with nothing', async () => {
    await restoreInviter()
    const token = await issue('concurrency-removal-first@example.invalid')
    await peer.query('BEGIN')
    await peer.query(`UPDATE user_management.organization_users SET is_active=false WHERE user_id=$1 AND organization_id=$2`, [inviter, orgA])
    const accepted = acceptInvite({ token })
    await new Promise(resolve => setTimeout(resolve, 200))
    await peer.query('COMMIT')
    await expect(accepted).resolves.toEqual({ success: false, error: 'Invalid or expired invite' })
    expect(await revoked('concurrency-removal-first@example.invalid')).toBe(true)
    expect((await owner.query(`SELECT count(*)::int AS n FROM user_management.users WHERE email=$1`, ['concurrency-removal-first@example.invalid'])).rows[0].n).toBe(0)
    await restoreInviter()
  }, 30_000)

  it('lets redemption commit under the inviter lock before offboarding revokes only invitations still pending', async () => {
    await restoreInviter()
    await owner.query(`CREATE TABLE IF NOT EXISTS user_management.concurrency_gate(id int PRIMARY KEY, open boolean NOT NULL)`)
    await owner.query(`INSERT INTO user_management.concurrency_gate(id, open) VALUES (1, false)
      ON CONFLICT (id) DO UPDATE SET open=false`)
    await owner.query(`CREATE OR REPLACE FUNCTION user_management.concurrency_wait() RETURNS trigger
      LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
      DECLARE deadline timestamptz := clock_timestamp() + interval '20 seconds';
      BEGIN
        IF NEW.email LIKE 'concurrency-redeem-first@%' THEN
          WHILE NOT COALESCE((SELECT open FROM user_management.concurrency_gate WHERE id=1), true)
            AND clock_timestamp() < deadline LOOP
            PERFORM pg_sleep(0.05);
          END LOOP;
        END IF;
        RETURN NEW;
      END $fn$`)
    await owner.query(`DROP TRIGGER IF EXISTS concurrency_wait ON user_management.users`)
    await owner.query(`CREATE TRIGGER concurrency_wait BEFORE INSERT ON user_management.users
      FOR EACH ROW EXECUTE FUNCTION user_management.concurrency_wait()`)
    const token = await issue('concurrency-redeem-first@example.invalid')
    await issue('concurrency-redeem-first-sibling@example.invalid')
    let settled = false
    const accepted = acceptInvite({ token }).finally(() => { settled = true })
    let blocked = false
    try {
      const deadline = Date.now() + 8_000
      while (!blocked && !settled && Date.now() < deadline) {
        await peer.query('BEGIN')
        await peer.query(`SET LOCAL lock_timeout = '300ms'`)
        try {
          await peer.query(`UPDATE user_management.users SET lifecycle_state='suspended', is_active=false WHERE user_id=$1`, [inviter])
          await peer.query('ROLLBACK')
        } catch (error) {
          await peer.query('ROLLBACK')
          if (!lockTimeout(error)) throw error
          blocked = true
        }
      }
      expect(blocked).toBe(true)
      await owner.query(`UPDATE user_management.concurrency_gate SET open=true WHERE id=1`)
      await expect(accepted).resolves.toMatchObject({ success: true, user: { organizationId: orgA } })
      await peer.query('BEGIN')
      await peer.query(`UPDATE user_management.users SET lifecycle_state='suspended', is_active=false WHERE user_id=$1`, [inviter])
      await peer.query('COMMIT')
      expect(await revoked('concurrency-redeem-first@example.invalid')).toBe(false)
      expect(await revoked('concurrency-redeem-first-sibling@example.invalid')).toBe(true)
    } finally {
      await owner.query(`UPDATE user_management.concurrency_gate SET open=true WHERE id=1`).catch(() => undefined)
      await owner.query(`DROP TRIGGER IF EXISTS concurrency_wait ON user_management.users`).catch(() => undefined)
      await restoreInviter().catch(() => undefined)
    }
  }, 30_000)
})

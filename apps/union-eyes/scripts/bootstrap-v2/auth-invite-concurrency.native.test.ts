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
import { acceptInvite } from '../../../../packages/platform-auth/src/invites/service'
import { AUTH_EXECUTION_ROLES, compileAuthBootstrapSql } from './auth-sql'
import { compileSyntheticAuthFixtureSql } from './auth-fixture'

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

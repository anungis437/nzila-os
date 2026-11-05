/**
 * Route-guard revocation closure on the REAL binding code (packages/platform-auth org-binding.ts, password/session.ts,
 * lifecycle/service.ts) over PGlite relations that carry the real column set of user_management.users,
 * organization_users and user_sessions. The ordinary-transaction guard (`withRLSContext` in V2) is
 * `withCanonicalOrganizationBinding` -> `withAuthenticatedOrgBinding`; this proves the binder it rests on:
 *
 *   revoked / expired session, deactivated or removed membership, suspended / deprovisioned / inactive user,
 *   another organization, a session bound to a different organization  =>  NO binding, so no handler (and so no
 *   designation, triage queue, external grant, document grant or API route behind it) ever runs.
 *
 * It also shows what the database is handed: a 30-second bridge token that is not the caller's cookie, revoked when the
 * callback ends, accepted by the real session predicate while live and refused afterwards.
 * Not a staging pass; PGlite is not the deployed cluster and the auth gateway roles are not reproduced here.
 */
import { createHash } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { sql } from 'drizzle-orm'
import { compileAuthOrgBindingSql } from '@nzila/db/auth-storage-authority'

const state = vi.hoisted(() => ({
  db: null as unknown as Record<string, unknown>,
  actor: { userId: null as string | null, orgId: null as string | null, identityProvider: 'nzila-password' as string | null },
  cookie: null as string | null,
}))

vi.mock('@nzila/platform-auth/auth-execution', () => ({
  authDb: new Proxy({}, {
    get: (_target, property) => {
      const value = Reflect.get(state.db, property)
      return typeof value === 'function' ? value.bind(state.db) : value
    },
  }),
  withAuthContext: async (_context: unknown, callback: () => Promise<unknown>) => callback(),
  withAuthSavepoint: async (callback: () => Promise<unknown>) => callback(),
  getAuthContext: () => undefined,
}))
// The workspace alias stubs @nzila/platform-auth/entra/server; the binder imports the real file by relative path.
vi.mock('../../../../../packages/platform-auth/src/entra/server', () => ({ auth: async () => ({ ...state.actor }) }))
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (name === 'nzila_session' && state.cookie ? { value: state.cookie } : undefined), set: () => undefined }),
}))

import { AuthOrgBindingError, authenticatedOrgBindingSql, withAuthenticatedOrgBinding, withBearerOrgBinding } from '@nzila/platform-auth/org-binding'
import { createSession, revokeAllUserSessions, revokeSession } from '@nzila/platform-auth/password'
import { deprovisionUser, suspendUser } from '@nzila/platform-auth/lifecycle'
import { sanitizedBindingError } from '@/lib/db/binding-error'

const ORG = '11111111-1111-4111-8111-111111111111'
const ORG_B = '22222222-2222-4222-8222-222222222222'
const USER = 'user_revocation_probe'
const ADMIN = 'user_lifecycle_admin'
const hash = (token: string) => createHash('sha256').update(token).digest('hex')

let pg: PGlite
let cookie: string
let sessionId: string

const q = (statement: string, params: unknown[] = []) => pg.query(statement, params)

async function fresh() {
  await pg.exec(`DELETE FROM user_management.user_sessions; DELETE FROM user_management.organization_users; DELETE FROM user_management.users;`)
  await q(`INSERT INTO user_management.users (user_id, email) VALUES ($1, 'probe@example.test'), ($2, 'admin@example.test')`, [USER, ADMIN])
  await q(`INSERT INTO user_management.organization_users (organization_id, user_id, role, is_active, is_primary) VALUES ($1, $2, 'steward', true, true)`, [ORG, USER])
  const created = await createSession({ userId: USER, organizationId: ORG })
  cookie = created.token
  sessionId = created.session.sessionId
  state.cookie = cookie
  state.actor = { userId: USER, orgId: ORG, identityProvider: 'nzila-password' }
}

beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(`
    CREATE SCHEMA user_management;
    CREATE TABLE user_management.users (
      user_id varchar(255) PRIMARY KEY, email varchar(255) NOT NULL UNIQUE, email_verified boolean DEFAULT false, email_verified_at timestamptz,
      password_hash text, first_name varchar(100), last_name varchar(100), display_name varchar(200), avatar_url text, phone varchar(20),
      phone_verified boolean DEFAULT false, timezone varchar(50) DEFAULT 'UTC', locale varchar(10) DEFAULT 'en-US', is_active boolean DEFAULT true,
      is_system_admin boolean DEFAULT false, last_login_at timestamptz, last_login_ip varchar(45), password_changed_at timestamptz,
      failed_login_attempts integer DEFAULT 0, account_locked_until timestamptz, two_factor_enabled boolean DEFAULT false,
      account_source varchar(20) NOT NULL DEFAULT 'local', lifecycle_state varchar(20) NOT NULL DEFAULT 'active', lifecycle_reason text,
      lifecycle_changed_at timestamptz, lifecycle_changed_by varchar(255), created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
    CREATE TABLE user_management.organization_users (
      organization_user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, user_id varchar(255) NOT NULL,
      role varchar(50) NOT NULL DEFAULT 'member', permissions jsonb DEFAULT '[]'::jsonb, is_active boolean DEFAULT true, is_primary boolean DEFAULT false,
      invited_by varchar(255), invited_at timestamptz, joined_at timestamptz, last_access_at timestamptz, created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(), UNIQUE (user_id, organization_id));
    CREATE TABLE user_management.user_sessions (
      session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar(255) NOT NULL, organization_id uuid, session_token text NOT NULL UNIQUE,
      refresh_token text UNIQUE, device_info jsonb DEFAULT '{}'::jsonb, ip_address varchar(45), user_agent text, expires_at timestamptz NOT NULL,
      is_active boolean DEFAULT true, session_token_hash text, created_at timestamptz DEFAULT now(), last_used_at timestamptz DEFAULT now());
    CREATE TABLE user_management.auth_audit_log (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar(255), event_type varchar(50) NOT NULL, ip_address varchar(45), user_agent text,
      metadata jsonb DEFAULT '{}'::jsonb, created_at timestamptz DEFAULT now());
    DO $$ BEGIN
      CREATE ROLE nzila_auth_org_authority_reader NOLOGIN NOINHERIT;
      CREATE ROLE union_eyes_runtime NOLOGIN NOINHERIT;
    END $$;
    ${compileAuthOrgBindingSql()}
  `)
  state.db = drizzle(pg) as unknown as Record<string, unknown>
})
afterAll(async () => { await pg?.close() })
beforeEach(fresh)

const viaCookie = (options: { organizationId?: string; expectedActorUserId?: string } = {}) =>
  withAuthenticatedOrgBinding({ organizationId: ORG, ...options }, async (binding) => binding)
const viaBearer = (token: string, options: { organizationId?: string } = {}) =>
  withBearerOrgBinding(token, { organizationId: ORG, ...options }, async (binding) => binding)
const denied = (promise: Promise<unknown>, code: AuthOrgBindingError['code']) => expect(promise).rejects.toMatchObject({ name: 'AuthOrgBindingError', code })

/** Every way the route guard can be entered: the cookie path (V2 ordinary transactions) and the bearer path. */
const ENTRIES: Array<[string, () => Promise<unknown>]> = [
  ['cookie (withAuthenticatedOrgBinding)', () => viaCookie()],
  ['bearer (withBearerOrgBinding)', () => viaBearer(cookie)],
]

describe('positive control and what the database is handed', () => {
  it('binds an active member with a live session; the bridge is not the cookie and lives at most 30 seconds', async () => {
    const binding = await viaCookie()
    expect(binding).toMatchObject({ userId: USER, organizationId: ORG, role: 'steward', authority: 'pg-session' })
    expect(binding.sessionToken).not.toBe(cookie)
    expect(binding.sessionToken).not.toBe(hash(cookie))
    expect(binding.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(31_000)
  })

  it('the bridge opens the real session predicate while the callback runs, and is dead afterwards; the cookie never reaches PostgreSQL', async () => {
    let live: boolean | undefined
    let setting: string | undefined
    let bridgeToken = ''
    await withBearerOrgBinding(cookie, { organizationId: ORG }, async (binding) => {
      bridgeToken = binding.sessionToken
      await pg.exec('BEGIN')
      try {
        await pg.exec('SET LOCAL ROLE union_eyes_runtime')
        await (state.db as unknown as ReturnType<typeof drizzle>).execute(authenticatedOrgBindingSql(binding))
        setting = (await pg.query<{ s: string }>(`SELECT current_setting('app.current_session_token') AS s`)).rows[0].s
        live = (await pg.query<{ ok: boolean }>(`SELECT user_management.auth_business_org_authorized($1::uuid, NULL) AS ok`, [ORG])).rows[0].ok
      } finally {
        await pg.exec('ROLLBACK')
      }
    })
    expect(live).toBe(true)
    expect(setting).toBe(bridgeToken)
    expect(setting).not.toBe(cookie)
    const after = (await q(`SELECT is_active FROM user_management.user_sessions WHERE session_token_hash = $1`, [hash(bridgeToken)])).rows as Array<{ is_active: boolean }>
    expect(after).toEqual([{ is_active: false }])
    // The caller's own session is untouched by the bridge's end.
    expect((await q(`SELECT is_active FROM user_management.user_sessions WHERE session_id = $1`, [sessionId])).rows).toEqual([{ is_active: true }])
  })

  it('the bridge is revoked even when the callback fails', async () => {
    let bridgeToken = ''
    await expect(withBearerOrgBinding(cookie, { organizationId: ORG }, async (binding) => { bridgeToken = binding.sessionToken; throw new Error('handler failed') })).rejects.toThrow('handler failed')
    expect((await q(`SELECT is_active FROM user_management.user_sessions WHERE session_token_hash = $1`, [hash(bridgeToken)])).rows).toEqual([{ is_active: false }])
  })
})

describe.each(ENTRIES)('a revoked or lapsed credential yields no binding: %s', (_name, enter) => {
  it('revoked session (logout)', async () => {
    await revokeSession(sessionId)
    await denied(enter(), 'SESSION_AUTHORITY_REQUIRED')
  })
  it('every session revoked (password reset, offboarding)', async () => {
    await revokeAllUserSessions(USER)
    await denied(enter(), 'SESSION_AUTHORITY_REQUIRED')
  })
  it('expired session', async () => {
    await q(`UPDATE user_management.user_sessions SET expires_at = now() - interval '1 second' WHERE session_id = $1`, [sessionId])
    await denied(enter(), 'SESSION_AUTHORITY_REQUIRED')
  })
  it('an unknown or forged cookie', async () => {
    state.cookie = 'forged'
    await denied(viaCookie(), 'SESSION_AUTHORITY_REQUIRED')
    await denied(viaBearer('forged'), 'SESSION_AUTHORITY_REQUIRED')
  })
})

describe.each(ENTRIES)('a live session never outlives the membership or the user: %s', (_name, enter) => {
  it('membership deactivated', async () => {
    await q(`UPDATE user_management.organization_users SET is_active = false WHERE user_id = $1`, [USER])
    await denied(enter(), 'MEMBERSHIP_REQUIRED')
  })
  it('membership removed', async () => {
    await q(`DELETE FROM user_management.organization_users WHERE user_id = $1`, [USER])
    await denied(enter(), 'MEMBERSHIP_REQUIRED')
  })
  it.each(['suspended', 'deprovisioned'])('user %s with the session and the membership still active', async (lifecycle) => {
    await q(`UPDATE user_management.users SET lifecycle_state = $2 WHERE user_id = $1`, [USER, lifecycle])
    await denied(enter(), 'MEMBERSHIP_REQUIRED')
  })
  it('user deactivated', async () => {
    await q(`UPDATE user_management.users SET is_active = false WHERE user_id = $1`, [USER])
    await denied(enter(), 'MEMBERSHIP_REQUIRED')
  })
})

describe('organization and actor confinement', () => {
  it('another organization the user does not belong to', async () => {
    await denied(viaCookie({ organizationId: ORG_B }), 'MEMBERSHIP_REQUIRED')
  })
  it('a session bound to one organization cannot be used for another, even where a membership exists', async () => {
    await q(`INSERT INTO user_management.organization_users (organization_id, user_id, role, is_active) VALUES ($1, $2, 'member', true)`, [ORG_B, USER])
    await denied(viaCookie({ organizationId: ORG_B }), 'MEMBERSHIP_REQUIRED')
  })
  it('the authenticated actor must be the expected actor', async () => {
    await denied(viaCookie({ expectedActorUserId: 'someone-else' }), 'ACTOR_MISMATCH')
  })
  it('a cookie that belongs to a different user than the authenticated actor is refused', async () => {
    state.actor = { userId: ADMIN, orgId: ORG, identityProvider: 'nzila-password' }
    await denied(viaCookie(), 'SESSION_AUTHORITY_REQUIRED')
  })
})

describe('the real lifecycle service ends access through the same guard', () => {
  beforeEach(() => {
    // Lifecycle administrators are checked against the authenticated actor.
    state.actor = { userId: ADMIN, orgId: ORG, identityProvider: 'nzila-password' }
  })
  const asMember = () => { state.actor = { userId: USER, orgId: ORG, identityProvider: 'nzila-password' } }

  it('suspension: the still-live session and active membership no longer bind', async () => {
    expect(await suspendUser(USER, ADMIN, 'investigation')).toEqual({ success: true })
    expect((await q(`SELECT is_active FROM user_management.user_sessions WHERE session_id = $1`, [sessionId])).rows).toEqual([{ is_active: true }])
    asMember()
    await denied(viaCookie(), 'MEMBERSHIP_REQUIRED')
    await denied(viaBearer(cookie), 'MEMBERSHIP_REQUIRED')
  })

  it('deprovisioning revokes every session as well as the identity', async () => {
    const result = await deprovisionUser(USER, ADMIN, 'left the union')
    expect(result.success).toBe(true)
    expect(result.sessionsRevoked).toBeGreaterThanOrEqual(1)
    asMember()
    await denied(viaCookie(), 'SESSION_AUTHORITY_REQUIRED')
  })
})

describe('binding failure never leaks the bridge token (UE-CONV-A-004)', () => {
  it('a failing set_config statement surfaces only the SQLSTATE, not Drizzle’s statement text and parameters', async () => {
    const failing = sql`SELECT set_config('app.current_session_token', ${'SECRET-BRIDGE-TOKEN'}, true), 1/0`
    let raw: unknown
    try {
      await (state.db as unknown as ReturnType<typeof drizzle>).execute(failing)
    } catch (error) {
      raw = error
    }
    // Without the sanitizer Drizzle's own message carries the parameter.
    expect(String((raw as Error).message)).toContain('SECRET-BRIDGE-TOKEN')
    const sanitized = sanitizedBindingError(raw)
    expect(sanitized.message).not.toContain('SECRET-BRIDGE-TOKEN')
    expect(sanitized.message).not.toMatch(/set_config|params|Failed query/i)
    expect(sanitized.message).toMatch(/SQLSTATE 22012/)
    expect(sanitized.cause).toBeUndefined()
    expect(Object.keys(sanitized)).toEqual([])
  })

  it('an error with no SQLSTATE yields a generic message', () => {
    expect(sanitizedBindingError(new Error('Failed query: params: SECRET')).message).toBe('Failed to establish the authenticated organization context')
    expect(sanitizedBindingError(null).message).toBe('Failed to establish the authenticated organization context')
  })
})

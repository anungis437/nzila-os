import { createHash, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createServer, type Server } from 'node:http'
import { once } from 'node:events'
import express from 'express'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { openNativeRuntimeFixture } from './native-runtime-fixture'
import { folder, type V2Plan } from './source'
import {
  authenticate,
  requireFinancialSystemAdministrator,
  type FinancialRequest,
} from '../../services/financial-service/src/middleware/authentication'

const state = vi.hoisted(() => ({
  actor: 'ue-v2-selection-actor',
  provider: 'nzila-password',
  orgId: null as string | null,
  cookies: new Map<string, string>(),
}))
const authModule = () => ({
  auth: async () => {
    if (state.provider === 'signed-local-acceptance') {
      const actual = await vi.importActual<
        typeof import('../../../../packages/platform-auth/src/entra/server')
      >('../../../../packages/platform-auth/src/entra/server')
      return actual.auth()
    }
    return { userId: state.actor, identityProvider: state.provider, orgId: state.orgId }
  },
  currentUser: async () => ({ publicMetadata: { role: 'app_owner', isSystemAdmin: true } }),
})
vi.mock('@nzila/platform-auth/entra/server', () => authModule())
vi.mock('../../../../packages/platform-auth/src/entra/server', () => authModule())
vi.mock('../../../../packages/platform-auth/src/entra/config', () => ({
  auth: async () => null,
}))
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: (name: string) => {
      const value = state.cookies.get(name)
      return value === undefined ? undefined : { value }
    },
  }),
}))

const native = process.env.UE_V2_NATIVE_MANIFEST === '1' ? describe : describe.skip
native('canonical organization selection with genuine restricted application execution', () => {
  const first = '11111111-1111-4111-8111-111111111111'
  const second = '22222222-2222-4222-8222-222222222222'
  const foreign = '33333333-3333-4333-8333-333333333333'
  const actor = 'ue-v2-selection-actor'
  const noMembership = 'ue-v2-selection-no-membership'
  const preferenceName = 'ue_canonical_org_preference'
  const sessionName = 'nzila_session'
  let fixture: Awaited<ReturnType<typeof openNativeRuntimeFixture>>
  let getRoute: typeof import('../../app/api/users/me/organizations/route').GET
  let switchRoute: typeof import('../../app/api/organizations/switch/route').POST
  let treeRoute: typeof import('../../app/api/organizations/tree/route').GET
  let pathRoute: typeof import('../../app/api/organizations/[id]/path/route').GET
  let originalToken: string
  let originalExpiry: string
  let financialServer: Server | undefined
  let financialUrl: string

  beforeAll(async () => {
    const plan: V2Plan = JSON.parse(
      readFileSync(path.join(folder, 'UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json'), 'utf8'),
    )
    fixture = await openNativeRuntimeFixture(plan, { auth: true })
    if (!fixture.authUrl) throw new Error('Native organization auth fixture is required')
    vi.stubEnv('DATABASE_URL', fixture.runtimeUrl)
    vi.stubEnv('SYSTEM_DATABASE_URL', fixture.systemUrl)
    vi.stubEnv('AUTH_DATABASE_URL', fixture.authUrl)
    vi.stubEnv('DATABASE_TYPE', 'postgresql')
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '1')
    await fixture.seed.query(
      `INSERT INTO public.organizations
      (id,name,slug,organization_type,hierarchy_path,hierarchy_level,sectors,clc_affiliated,
       member_count,active_member_count,settings,features_enabled,status,remittance_day,created_at,updated_at)
      SELECT id,'Synthetic selection organization','ue-native-selection-'||id::text,'local',ARRAY[]::text[],0,
        ARRAY[]::varchar[],false,0,0,'{}',ARRAY[]::text[],'active',15,now(),now()
      FROM unnest($1::uuid[]) AS fixture(id)`,
      [[first, second, foreign]],
    )
    await fixture.seed.query(
      `INSERT INTO user_management.users(user_id,email)
      VALUES ($1,'selection-actor@example.invalid'),($2,'selection-no-membership@example.invalid'),
        ('ue-v2-selection-foreign','selection-foreign@example.invalid')`,
      [actor, noMembership],
    )
    await fixture.seed.query(
      `INSERT INTO user_management.organization_users
      (user_id,organization_id,role,is_primary,is_active,joined_at)
      VALUES ($1,$2,'member',true,true,now()),($1,$3,'admin',false,true,now()),
        ('ue-v2-selection-foreign',$4,'admin',true,true,now())`,
      [actor, first, second, foreign],
    )
    getRoute = (await import('../../app/api/users/me/organizations/route')).GET
    switchRoute = (await import('../../app/api/organizations/switch/route')).POST
    treeRoute = (await import('../../app/api/organizations/tree/route')).GET
    pathRoute = (await import('../../app/api/organizations/[id]/path/route')).GET
    const financialApp = express()
    financialApp.get('/actor', authenticate, (req: FinancialRequest, res) => {
      setImmediate(() => res.json({ actor: req.user }))
    })
    financialApp.post('/system', authenticate, requireFinancialSystemAdministrator, (_req, res) => {
      res.json({ allowed: true })
    })
    financialServer = createServer(financialApp)
    financialServer.listen(0, '127.0.0.1')
    await once(financialServer, 'listening')
    const address = financialServer.address()
    if (!address || typeof address === 'string') throw new Error('Owned financial listener missing')
    financialUrl = `http://127.0.0.1:${address.port}`
  }, 600000)

  beforeEach(async () => {
    vi.restoreAllMocks()
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('UNION_EYES_ACCEPTANCE_AUTH_ENABLED', 'false')
    vi.stubEnv('AZURE_AD_CLIENT_ID', '')
    vi.stubEnv('AZURE_AD_TENANT_ID', '')
    state.actor = actor
    state.provider = 'nzila-password'
    state.orgId = null
    state.cookies.clear()
    await fixture.seed.query(
      `UPDATE user_management.users SET is_active=true,lifecycle_state='active',
      is_system_admin=false WHERE user_id=ANY($1::text[])`,
      [[actor, noMembership]],
    )
    await fixture.seed.query(
      `UPDATE user_management.organization_users SET is_active=true
      WHERE user_id=$1`,
      [actor],
    )
    await fixture.seed.query(
      `UPDATE public.organizations SET status='active',parent_id=NULL,hierarchy_path=ARRAY[]::text[]
        WHERE id=ANY($1::uuid[])`,
      [[first, second, foreign]],
    )
    await fixture.seed.query(
      `DELETE FROM user_management.user_sessions WHERE user_id=ANY($1::text[])`,
      [[actor, noMembership]],
    )
    originalToken = randomBytes(32).toString('base64url')
    const hash = createHash('sha256').update(originalToken).digest('hex')
    const result = await fixture.seed.query(
      `INSERT INTO user_management.user_sessions
      (user_id,organization_id,session_token,session_token_hash,expires_at,is_active)
      VALUES ($1,$2,$3,$3,statement_timestamp()+interval '3 hours 123 microseconds',true)
      RETURNING expires_at::text AS expiry`,
      [actor, first, hash],
    )
    originalExpiry = result.rows[0].expiry
    state.cookies.set(sessionName, originalToken)
  })

  afterAll(async () => {
    const failures: unknown[] = []
    if (financialServer?.listening) {
      financialServer.closeAllConnections()
      try {
        await new Promise<void>((resolve, reject) => {
          financialServer!.close((error) => (error ? reject(error) : resolve()))
        })
      } catch (error) {
        failures.push(error)
      }
    }
    const { closeAuthClients } = await import('../../../../packages/db/src/auth-client')
    const { closeSystemClient } = await import('../../db/system-db')
    const { client } = await import('../../db/db')
    const closed = await Promise.allSettled([
      closeAuthClients(),
      closeSystemClient(),
      client.end({ timeout: 5 }),
    ])
    for (const result of closed) if (result.status === 'rejected') failures.push(result.reason)
    try {
      await fixture?.dispose()
    } catch (error) {
      failures.push(error)
    } finally {
      vi.unstubAllEnvs()
    }
    if (failures.length)
      throw new AggregateError(failures, 'Canonical organization fixture cleanup failed')
  })

  const list = () => getRoute(new NextRequest('http://localhost/api/users/me/organizations'))
  const switchTo = (organizationId: unknown) =>
    switchRoute(
      new NextRequest('http://localhost/api/organizations/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId }),
      }),
    )
  const nextRows = async () => {
    const { withRLSContext } = await import('../../lib/db/with-rls-context')
    return withRLSContext((tx) => tx.execute(sql`SELECT id FROM public.organizations ORDER BY id`))
  }
  const hierarchyPath = (id: string) =>
    pathRoute(new NextRequest(`http://localhost/api/organizations/${id}/path`), {
      params: Promise.resolve({ id }),
    })

  const financialActor = (extraHeaders: Record<string, string> = {}) =>
    fetch(`${financialUrl}/actor`, {
      headers: { authorization: `Bearer ${originalToken}`, ...extraHeaders },
    })

  it('authenticates financial HTTP using a genuine selected canonical session and live membership', async () => {
    const response = await financialActor()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      actor: {
        id: actor,
        userId: actor,
        tenantId: first,
        organizationId: first,
        role: 'member',
        isSystemAdmin: false,
      },
    })
  })

  it('does not authenticate financial HTTP through the development impersonation header', async () => {
    const response = await fetch(`${financialUrl}/actor`, { headers: { 'x-test-user': actor } })
    expect(response.status).toBe(401)
  })

  it('does not select a financial organization through a header on an unselected login', async () => {
    await fixture.seed.query(
      'UPDATE user_management.user_sessions SET organization_id=NULL WHERE user_id=$1',
      [actor],
    )
    expect((await financialActor({ 'x-organization-id': first })).status).toBe(403)
  })

  it('rejects a financial organization selector different from the genuine selected session', async () => {
    expect((await financialActor({ 'x-organization-id': second })).status).toBe(403)
  })

  it('rejects revoked financial bearer sessions through the real authentication database', async () => {
    await fixture.seed.query(
      'UPDATE user_management.user_sessions SET is_active=false WHERE user_id=$1',
      [actor],
    )
    expect((await financialActor()).status).toBe(401)
  })

  it('rejects expired financial bearer sessions through the real authentication database', async () => {
    await fixture.seed.query(
      `UPDATE user_management.user_sessions
       SET created_at=statement_timestamp()-interval '1 hour',
       expires_at=statement_timestamp()-interval '1 second'
       WHERE user_id=$1`,
      [actor],
    )
    expect((await financialActor()).status).toBe(401)
  })

  it('denies financial HTTP after canonical membership is deactivated', async () => {
    await fixture.seed.query(
      'UPDATE user_management.organization_users SET is_active=false WHERE user_id=$1',
      [actor],
    )
    expect((await financialActor()).status).toBe(403)
  })

  it('denies financial HTTP after canonical user is deactivated', async () => {
    await fixture.seed.query(
      "UPDATE user_management.users SET is_active=false,lifecycle_state='suspended' WHERE user_id=$1",
      [actor],
    )
    expect([401, 403]).toContain((await financialActor()).status)
  })

  it('rereads the canonical financial role instead of trusting forged request claims', async () => {
    await fixture.seed.query(
      `UPDATE user_management.organization_users SET role='admin'
       WHERE user_id=$1 AND organization_id=$2`,
      [actor, first],
    )
    const response = await financialActor({ 'x-role': 'app_owner', 'x-user-id': noMembership })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      actor: { userId: actor, role: 'admin', isSystemAdmin: false },
    })
    await fixture.seed.query(
      `UPDATE user_management.organization_users SET role='member'
       WHERE user_id=$1 AND organization_id=$2`,
      [actor, first],
    )
  })

  it('does not decode unsigned provider JWTs when financial provider authority is unconfigured', async () => {
    const token = [
      Buffer.from('{"alg":"none"}').toString('base64url'),
      Buffer.from(JSON.stringify({ sub: actor, tenant_id: first, org_role: 'admin' })).toString(
        'base64url',
      ),
      '',
    ].join('.')
    const response = await fetch(`${financialUrl}/actor`, {
      headers: { authorization: `Bearer ${token}`, 'x-organization-id': first },
    })
    expect(response.status).toBe(401)
  })

  it('requires genuine canonical system-administrator authority for global financial execution', async () => {
    const invoke = () =>
      fetch(`${financialUrl}/system`, {
        method: 'POST',
        headers: { authorization: `Bearer ${originalToken}` },
      })
    expect((await invoke()).status).toBe(403)
    await fixture.seed.query(
      'UPDATE user_management.users SET is_system_admin=true WHERE user_id=$1',
      [actor],
    )
    expect((await invoke()).status).toBe(200)
  })

  it('returns only private-member organizations in the canonical hierarchy tree', async () => {
    const response = await treeRoute(new NextRequest('http://localhost/api/organizations/tree'))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.organizationAuthority).toBe('CANONICAL_CURRENT_STATE_V2')
    expect(body.hierarchyScope).toBe('ACTIVE_PRIVATE_MEMBERSHIPS')
    expect(body.data.map((organization: { id: string }) => organization.id).sort()).toEqual([
      first,
      second,
    ])
  })

  it('returns owned hierarchy ancestors without granting a new organization context', async () => {
    await fixture.seed.query(
      'UPDATE public.organizations SET parent_id=$1,hierarchy_path=$2::text[] WHERE id=$3',
      [first, [first, second], second],
    )
    const response = await hierarchyPath(second)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.map((organization: { id: string }) => organization.id)).toEqual([
      first,
      second,
    ])
    expect(body.completePath).toBe(true)
    expect(body.omittedAncestorCount).toBe(0)
    expect((await nextRows()).map((row) => row.id)).toEqual([first])
  })

  it('reports partial ancestry rather than exposing unowned organization metadata', async () => {
    await fixture.seed.query(
      'UPDATE public.organizations SET parent_id=$1,hierarchy_path=$2::text[] WHERE id=$3',
      [foreign, [foreign, second], second],
    )
    const response = await hierarchyPath(second)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.map((organization: { id: string }) => organization.id)).toEqual([second])
    expect(body.completePath).toBe(false)
    expect(body.omittedAncestorCount).toBe(1)
    expect(body.hierarchyScope).toBe('ACTIVE_PRIVATE_MEMBERSHIPS')
  })

  it('denies a foreign hierarchy path instead of an empty-success result', async () => {
    expect((await hierarchyPath(foreign)).status).toBe(403)
  })

  it('enumerates only active private memberships despite forged public administrator metadata and legacy cookies', async () => {
    state.cookies.set('selected_organization_id', foreign)
    state.cookies.set('selected_org_id', foreign)
    const response = await list()
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.organizationAuthority).toBe('CANONICAL_CURRENT_STATE_V2')
    expect(data.activeOrganizationId).toBe(first)
    expect(
      data.organizations.map((organization: { id: string }) => organization.id).sort(),
    ).toEqual([first, second])
    expect(
      data.memberships.every((membership: { userId: string }) => membership.userId === actor),
    ).toBe(true)
  })

  it('does not fabricate platform administrator memberships', async () => {
    await fixture.seed.query(
      'UPDATE user_management.users SET is_system_admin=true WHERE user_id=$1',
      [actor],
    )
    expect((await (await list()).json()).organizations).toHaveLength(2)
    expect((await switchTo(foreign)).status).toBe(403)
  })

  it('returns an authenticated empty canonical list for a private profile with no memberships', async () => {
    state.actor = noMembership
    const hash = createHash('sha256').update(originalToken).digest('hex')
    await fixture.seed.query(
      `UPDATE user_management.user_sessions SET user_id=$1,organization_id=NULL
      WHERE session_token_hash=$2`,
      [noMembership, hash],
    )
    const response = await list()
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      organizations: [],
      memberships: [],
      activeOrganizationId: null,
    })
  })

  it('keeps a null password-session organization unselected until a genuine server rebind', async () => {
    await fixture.seed.query(
      'UPDATE user_management.user_sessions SET organization_id=NULL WHERE user_id=$1',
      [actor],
    )
    expect((await (await list()).json()).activeOrganizationId).toBeNull()
    await expect(nextRows()).rejects.toMatchObject({ code: 'MEMBERSHIP_REQUIRED' })
    const response = await switchTo(first)
    expect(response.status).toBe(200)
    const replacement = response.cookies.get(sessionName)?.value
    if (!replacement) throw new Error('Rebound session cookie is required')
    state.cookies.set(sessionName, replacement)
    expect((await nextRows()).map((row) => row.id)).toEqual([first])
  })

  it('rotates the bearer, preserves exact PostgreSQL expiry and binds the next request to the selected organization', async () => {
    const response = await switchTo(second)
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toMatchObject({
      activeOrganizationId: second,
      organizationAuthority: 'CANONICAL_CURRENT_STATE_V2',
    })
    const cookie = response.cookies.get(sessionName)
    expect(cookie?.httpOnly).toBe(true)
    expect(cookie?.sameSite).toBe('lax')
    expect(cookie?.value).not.toBe(originalToken)
    if (!cookie?.value) throw new Error('Canonical session response cookie is required')
    expect(JSON.stringify(data)).not.toContain(cookie.value)
    const rows = await fixture.seed.query(
      `SELECT organization_id,is_active,expires_at::text AS expiry,
      session_token_hash FROM user_management.user_sessions WHERE user_id=$1 ORDER BY created_at`,
      [actor],
    )
    expect(rows.rows).toHaveLength(2)
    expect(rows.rows.every((row) => row.expiry === originalExpiry)).toBe(true)
    expect(rows.rows.filter((row) => row.is_active)).toHaveLength(1)
    expect(rows.rows.find((row) => row.is_active).organization_id).toBe(second)
    expect(state.cookies.get(sessionName)).toBe(originalToken)
    expect((await list()).status).toBe(401)
    state.cookies.set(sessionName, cookie.value)
    expect((await (await list()).json()).activeOrganizationId).toBe(second)
    expect((await nextRows()).map((row) => row.id)).toEqual([second])
  })

  it('allows recovery from a revoked current membership without manufacturing authority', async () => {
    await fixture.seed.query(
      'UPDATE user_management.organization_users SET is_active=false WHERE user_id=$1 AND organization_id=$2',
      [actor, first],
    )
    expect((await (await list()).json()).activeOrganizationId).toBeNull()
    expect((await switchTo(second)).status).toBe(200)
  })

  it.each(['inactive-profile', 'revoked-session', 'expired-session', 'actor-mismatch'])(
    'denies %s before creating a replacement session',
    async (fault) => {
      if (fault === 'inactive-profile')
        await fixture.seed.query(
          'UPDATE user_management.users SET is_active=false WHERE user_id=$1',
          [actor],
        )
      if (fault === 'revoked-session')
        await fixture.seed.query(
          'UPDATE user_management.user_sessions SET is_active=false WHERE user_id=$1',
          [actor],
        )
      if (fault === 'expired-session')
        await fixture.seed.query(
          `UPDATE user_management.user_sessions
          SET created_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' WHERE user_id=$1`,
          [actor],
        )
      if (fault === 'actor-mismatch') state.actor = noMembership
      expect((await list()).status).toBe(401)
      const response = await switchTo(second)
      expect(response.status).toBe(401)
      expect(response.headers.get('set-cookie')).toBeNull()
      expect(
        (
          await fixture.seed.query(
            'SELECT count(*)::int AS count FROM user_management.user_sessions WHERE user_id=$1',
            [actor],
          )
        ).rows[0].count,
      ).toBe(1)
    },
  )

  it.each([foreign, '44444444-4444-4444-8444-444444444444'])(
    'denies foreign or unknown target %s without replacing the bearer',
    async (target) => {
      const response = await switchTo(target)
      expect(response.status).toBe(403)
      expect(response.headers.get('set-cookie')).toBeNull()
      expect(
        (
          await fixture.seed.query(
            'SELECT count(*)::int AS count FROM user_management.user_sessions WHERE user_id=$1',
            [actor],
          )
        ).rows[0].count,
      ).toBe(1)
    },
  )

  it('denies inactive organization metadata and excludes it from enumeration', async () => {
    await fixture.seed.query('UPDATE public.organizations SET status=$1 WHERE id=$2', [
      'inactive',
      second,
    ])
    expect((await switchTo(second)).status).toBe(403)
    expect((await (await list()).json()).organizations).toHaveLength(1)
  })

  it.each([null, 42, 'not-a-uuid'])('rejects malformed target %s', async (target) => {
    expect((await switchTo(target)).status).toBe(400)
  })

  it('rolls back both session mutations when response cookie preparation fails', async () => {
    const prototype = Object.getPrototypeOf(NextResponse.json({}).cookies)
    vi.spyOn(prototype, 'set').mockImplementationOnce(() => {
      throw new Error('Synthetic cookie preparation fault')
    })
    const response = await switchTo(second)
    expect(response.status).toBe(500)
    expect(response.headers.get('set-cookie')).toBeNull()
    const rows = await fixture.seed.query(
      'SELECT organization_id,is_active FROM user_management.user_sessions WHERE user_id=$1',
      [actor],
    )
    expect(rows.rows).toEqual([{ organization_id: first, is_active: true }])
    expect((await list()).status).toBe(200)
  })

  it('does not deliver the prepared cookie when actual PostgreSQL commit fails', async () => {
    await fixture.seed
      .query(`CREATE FUNCTION user_management.ue_selection_commit_fault() RETURNS trigger
      LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'Synthetic organization commit fault'; END$$;
      CREATE CONSTRAINT TRIGGER ue_selection_commit_fault AFTER INSERT ON user_management.user_sessions
      DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION user_management.ue_selection_commit_fault();`)
    try {
      const response = await switchTo(second)
      expect(response.status).toBe(500)
      expect(response.headers.get('set-cookie')).toBeNull()
      expect(
        (
          await fixture.seed.query(
            'SELECT organization_id,is_active FROM user_management.user_sessions WHERE user_id=$1',
            [actor],
          )
        ).rows,
      ).toEqual([{ organization_id: first, is_active: true }])
    } finally {
      await fixture.seed
        .query(`DROP TRIGGER ue_selection_commit_fault ON user_management.user_sessions;
        DROP FUNCTION user_management.ue_selection_commit_fault();`)
    }
    expect((await list()).status).toBe(200)
  })

  it('serializes concurrent rotations so only one request consumes the old bearer', async () => {
    const responses = await Promise.all([switchTo(first), switchTo(second)])
    expect(responses.map((response) => response.status).sort()).toEqual([200, 401])
    expect(responses.filter((response) => response.headers.has('set-cookie'))).toHaveLength(1)
    expect(
      (
        await fixture.seed.query(
          'SELECT count(*)::int AS count FROM user_management.user_sessions WHERE user_id=$1 AND is_active',
          [actor],
        )
      ).rows[0].count,
    ).toBe(1)
  })

  it('scopes a provider-adapter preference to live membership and revokes every short-lived bridge without minting a password cookie', async () => {
    state.provider = 'union-eyes-acceptance'
    state.orgId = first
    state.cookies.delete(sessionName)
    const response = await switchTo(second)
    expect(response.status).toBe(200)
    expect(response.cookies.get(sessionName)).toBeUndefined()
    const preference = response.cookies.get(preferenceName)
    if (!preference?.value) throw new Error('Provider organization preference cookie is required')
    state.cookies.set(preferenceName, preference.value)
    expect((await (await list()).json()).activeOrganizationId).toBe(second)
    expect((await nextRows()).map((row) => row.id)).toEqual([second])
    const bridges = await fixture.seed.query(
      `SELECT is_active,expires_at-created_at<=interval '30 seconds' AS bounded
      FROM user_management.user_sessions WHERE user_id=$1 AND device_info->>'purpose'='business-org-binding'`,
      [actor],
    )
    expect(bridges.rows.length).toBeGreaterThan(0)
    expect(bridges.rows.every((row) => !row.is_active && row.bounded)).toBe(true)
    await fixture.seed.query(
      'UPDATE user_management.organization_users SET is_active=false WHERE user_id=$1 AND organization_id=$2',
      [actor, second],
    )
    await expect(nextRows()).rejects.toMatchObject({ code: 'MEMBERSHIP_REQUIRED' })
  })

  it('executes the actual signed local acceptance credential resolver before preference selection and next-request RLS', async () => {
    const { mintAcceptanceAuthToken } =
      await import('../../../../packages/platform-auth/src/acceptance-auth')
    const secret = randomBytes(48).toString('base64url')
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('UE_ENVIRONMENT', 'staging')
    vi.stubEnv('UE_DEPLOYMENT_TYPE', 'staging')
    vi.stubEnv('UNION_EYES_ACCEPTANCE_AUTH_ENABLED', 'true')
    vi.stubEnv('UNION_EYES_ACCEPTANCE_AUTH_SECRET', secret)
    vi.stubEnv('UNION_EYES_ACCEPTANCE_AUTH_USER_IDS', actor)
    state.provider = 'signed-local-acceptance'
    state.cookies.delete(sessionName)
    const token = await mintAcceptanceAuthToken({ userId: actor, secret })
    state.cookies.set('ue_acceptance_auth', token)
    const response = await switchTo(second)
    expect(response.status).toBe(200)
    expect(response.cookies.get(sessionName)).toBeUndefined()
    const preference = response.cookies.get(preferenceName)
    if (!preference?.value) throw new Error('Signed provider preference is required')
    expect(preference.secure).toBe(true)
    expect(preference.httpOnly).toBe(true)
    state.cookies.set(preferenceName, preference.value)
    expect((await (await list()).json()).activeOrganizationId).toBe(second)
    expect((await nextRows()).map((row) => row.id)).toEqual([second])
    state.cookies.set('ue_acceptance_auth', `${token}invalid`)
    expect((await list()).status).toBe(401)
    const denied = await switchTo(first)
    expect(denied.status).toBe(401)
    expect(denied.headers.get('set-cookie')).toBeNull()
    expect(
      (
        await fixture.seed.query(
          `SELECT count(*)::int AS count FROM user_management.user_sessions
      WHERE user_id=$1 AND device_info->>'purpose'='business-org-binding' AND is_active`,
          [actor],
        )
      ).rows[0].count,
    ).toBe(0)
  })
})

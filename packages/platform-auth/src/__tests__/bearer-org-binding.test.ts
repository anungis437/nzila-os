import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  session: null as null | {
    sessionId: string
    userId: string
    organizationId: string | null
    expiresAt: Date
  },
  results: [] as Record<string, unknown>[][],
  verify: vi.fn(),
  identity: vi.fn(),
  revoke: vi.fn(),
  insert: vi.fn(),
}))
vi.mock('../password/session', () => ({
  SESSION_COOKIE_NAME: 'nzila_session',
  validateSession: async () => state.session,
}))
vi.mock('../entra/verify', () => ({ verifyToken: state.verify }))
vi.mock('../provider-identity', () => ({ resolveExternalAuthIdentity: state.identity }))
vi.mock('../auth-db', () => ({
  withAuthContext: async (_context: unknown, callback: () => Promise<unknown>) => callback(),
  authDb: {
    select: () => {
      const query = {
        from: () => query,
        where: () => query,
        orderBy: () => query,
        limit: async () => state.results.shift() ?? [],
      }
      return query
    },
    insert: () => ({ values: () => ({ returning: state.insert }) }),
    update: () => ({ set: () => ({ where: state.revoke }) }),
  },
}))

import { withBearerOrgBinding, type AuthenticatedOrgBinding } from '../org-binding'

describe('canonical bearer organization binding contract (unit, not runtime qualification)', () => {
  const organizationId = '11111111-1111-4111-8111-111111111111'
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('AZURE_AD_CLIENT_ID', 'synthetic-client')
    vi.stubEnv('AZURE_AD_TENANT_ID', 'synthetic-directory')
    state.session = {
      sessionId: 'session',
      userId: 'canonical-user',
      organizationId,
      expiresAt: new Date(Date.now() + 60000),
    }
    state.results = [
      [{ userId: 'canonical-user', isSystemAdmin: false }],
      [{ organizationId, role: 'member' }],
    ]
    state.insert.mockResolvedValue([{ expiresAt: new Date(Date.now() + 30000) }])
    state.revoke.mockResolvedValue(undefined)
    state.verify.mockResolvedValue({
      payload: {
        tid: 'directory',
        oid: 'immutable-object',
        sub: 'untrusted-platform-id',
        tenant_id: 'forged-organization',
        org_role: 'admin',
      },
    })
    state.identity.mockResolvedValue({ platformUserId: 'canonical-user' })
  })
  afterEach(() => vi.unstubAllEnvs())

  it.each(['', 'x'.repeat(16385)])('rejects empty or oversized credentials', async (token) => {
    await expect(withBearerOrgBinding(token, {}, vi.fn())).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
  })

  it('requires a live opaque session', async () => {
    state.session = null
    await expect(withBearerOrgBinding('opaque', {}, vi.fn())).rejects.toMatchObject({
      code: 'SESSION_AUTHORITY_REQUIRED',
    })
  })

  it('does not let a request selector turn an unselected login into a bound session', async () => {
    state.session!.organizationId = null
    await expect(withBearerOrgBinding('opaque', { organizationId }, vi.fn())).rejects.toMatchObject(
      { code: 'MEMBERSHIP_REQUIRED' },
    )
  })

  it('rejects an organization different from the selected session', async () => {
    await expect(
      withBearerOrgBinding(
        'opaque',
        {
          organizationId: '22222222-2222-4222-8222-222222222222',
        },
        vi.fn(),
      ),
    ).rejects.toMatchObject({ code: 'MEMBERSHIP_REQUIRED' })
  })

  it('rejects a forged actor identifier', async () => {
    await expect(
      withBearerOrgBinding('opaque', { expectedActorUserId: 'forged' }, vi.fn()),
    ).rejects.toMatchObject({ code: 'ACTOR_MISMATCH' })
  })

  it.each([0, 1])(
    'requires active canonical user and membership query results (%i)',
    async (index) => {
      state.results[index] = []
      await expect(withBearerOrgBinding('opaque', {}, vi.fn())).rejects.toMatchObject({
        code: 'MEMBERSHIP_REQUIRED',
      })
    },
  )

  it('enforces trusted route role requirements against live membership', async () => {
    await expect(
      withBearerOrgBinding('opaque', { requiredRoles: ['admin'] }, vi.fn()),
    ).rejects.toMatchObject({ code: 'ROLE_REQUIRED' })
  })

  it('retains selected canonical identity, role and opaque bearer', async () => {
    const callback = vi.fn(async (binding: AuthenticatedOrgBinding) => binding)
    const binding = await withBearerOrgBinding('opaque', {}, callback)
    expect(binding).toMatchObject({
      userId: 'canonical-user',
      organizationId,
      role: 'member',
      sessionToken: 'opaque',
      authority: 'pg-session',
      isSystemAdmin: false,
    })
    expect(state.verify).not.toHaveBeenCalled()
    expect(state.insert).not.toHaveBeenCalled()
    expect(state.revoke).not.toHaveBeenCalled()
  })

  it('requires explicit business organization selection for provider tokens', async () => {
    await expect(
      withBearerOrgBinding('header.payload.signature', {}, vi.fn()),
    ).rejects.toMatchObject({ code: 'MEMBERSHIP_REQUIRED' })
    expect(state.verify).not.toHaveBeenCalled()
  })

  it('never decodes a provider JWT without verification when configuration is absent', async () => {
    vi.stubEnv('AZURE_AD_CLIENT_ID', '')
    await expect(
      withBearerOrgBinding('header.payload.signature', { organizationId }, vi.fn()),
    ).rejects.toMatchObject({ code: 'SESSION_AUTHORITY_REQUIRED' })
    expect(state.verify).not.toHaveBeenCalled()
  })

  it('rejects failed signature verification before identity resolution', async () => {
    const cause = new Error('Invalid signature')
    state.verify.mockRejectedValue(cause)
    await expect(
      withBearerOrgBinding('header.payload.signature', { organizationId }, vi.fn()),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED', cause })
    expect(state.identity).not.toHaveBeenCalled()
  })

  it('requires a canonical mapping rather than trusting provider sub', async () => {
    state.identity.mockResolvedValue(null)
    await expect(
      withBearerOrgBinding('header.payload.signature', { organizationId }, vi.fn()),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
  })

  it('uses live membership rather than directory roles and revokes the provider bridge', async () => {
    await withBearerOrgBinding('header.payload.signature', { organizationId }, async (binding) => {
      expect(state.identity).toHaveBeenCalledWith('entra', 'directory:immutable-object')
      expect(binding).toMatchObject({
        userId: 'canonical-user',
        organizationId,
        role: 'member',
        authority: 'verified-provider-bridge',
      })
      expect(state.revoke).not.toHaveBeenCalled()
    })
    expect(state.revoke).toHaveBeenCalledOnce()
  })

  it('preserves both callback and bridge revocation failures', async () => {
    const executionError = new Error('Persistence failed')
    const revocationError = new Error('Revocation failed')
    state.revoke.mockRejectedValue(revocationError)
    await expect(
      withBearerOrgBinding('header.payload.signature', { organizationId }, async () => {
        throw executionError
      }),
    ).rejects.toMatchObject({
      errors: [executionError, revocationError],
      cause: executionError,
    })
  })
})

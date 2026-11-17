import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  rls: vi.fn(),
  active: vi.fn(),
  context: vi.fn(),
  legacyOrganization: vi.fn(),
  legacyRole: vi.fn(),
  requestScope: vi.fn(),
}))
vi.mock('@/lib/api-auth-guard', () => ({
  getCurrentUser: mocks.user,
  normalizeRole: (role: string) => role,
  ROLE_HIERARCHY: { member: 20, admin: 140, app_owner: 300 },
}))
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: mocks.rls,
  validateRLSContext: mocks.context,
}))
vi.mock('@/db/tenant-context-storage', () => ({ getActiveTenantDb: mocks.active }))
vi.mock('@/lib/organization-utils', () => ({
  getOrganizationIdForUser: mocks.legacyOrganization,
}))
vi.mock('@/lib/auth/rbac-server', () => ({ getUserRole: mocks.legacyRole }))
vi.mock('@/lib/auth/canonical-context', () => ({ withCanonicalApiContext: mocks.requestScope }))
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: async () => ({ allowed: true }),
  createRateLimitHeaders: () => ({}),
  RATE_LIMITS: { DEFAULT_API_ORG: {} },
}))
vi.mock('@/services/platform-economics/entitlement-guard', () => ({
  requireEntitlement: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { withApi } from '../with-api'
import { AuthOrgBindingError } from '@nzila/platform-auth/org-binding'

describe('opt-in canonical API authority', () => {
  const user = {
    id: 'canonical-user',
    role: 'member',
    organizationId: '11111111-1111-4111-8111-111111111111',
    isSystemAdmin: false,
  }
  const request = () => new NextRequest('http://localhost/api/synthetic-canonical-proof')
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '1')
    mocks.user.mockResolvedValue(user)
    mocks.rls.mockImplementation(async (_context, callback) => callback())
    mocks.active.mockReturnValue(undefined)
    mocks.legacyRole.mockResolvedValue('app_owner')
    mocks.legacyOrganization.mockResolvedValue('foreign-legacy-organization')
    mocks.requestScope.mockImplementation(async callback => callback())
  })
  afterEach(() => vi.unstubAllEnvs())

  it('requires canonical transaction context without relying on the legacy opt-in', async () => {
    const response = await withApi({}, async () => ({ own: true }))(request())
    expect(response.status).toBe(200)
    expect(mocks.rls).toHaveBeenCalledWith(
      { organizationId: user.organizationId },
      expect.any(Function),
    )
    expect(mocks.legacyOrganization).not.toHaveBeenCalled()
  })

  it('leaves slow work outside an outer transaction when the handler owns its database scopes', async () => {
    let active = false
    const betweenScopes: boolean[] = []
    mocks.rls.mockImplementation(async (_context, callback) => {
      const previous = active
      active = true
      try { return await callback() } finally { active = previous }
    })
    const response = await withApi({ rlsOrgContext: false }, async () => {
      await mocks.rls({ organizationId: user.organizationId }, async () => ({}))
      betweenScopes.push(active)
      await Promise.resolve() // external processing belongs between the two guarded database operations
      await mocks.rls({ organizationId: user.organizationId }, async () => ({}))
      return { processed: true }
    })(request())
    expect(response.status).toBe(200)
    expect(betweenScopes).toEqual([false])
    expect(mocks.rls).toHaveBeenCalledTimes(2)
  })

  it('keeps organization and authentication requirements for handlers managing their own database scopes', async () => {
    const handler = vi.fn()
    mocks.user.mockResolvedValueOnce({ ...user, organizationId: null })
    expect((await withApi({ rlsOrgContext: false }, handler)(request())).status).toBe(403)
    mocks.user.mockResolvedValueOnce(null)
    expect((await withApi({ rlsOrgContext: false }, handler)(request())).status).toBe(401)
    expect(handler).not.toHaveBeenCalled()
  })

  it('still refuses a mismatched inherited transaction for a handler managing its own scopes', async () => {
    mocks.active.mockReturnValueOnce({})
    mocks.context.mockResolvedValueOnce({ userId: user.id, orgId: 'foreign-organization' })
    const handler = vi.fn()
    expect((await withApi({ rlsOrgContext: false }, handler)(request())).status).toBe(403)
    expect(handler).not.toHaveBeenCalled()
  })

  it('does not upgrade canonical roles through a legacy fallback', async () => {
    const handler = vi.fn()
    const response = await withApi({ auth: { minRole: 'admin' } }, handler)(request())
    expect(response.status).toBe(403)
    expect(handler).not.toHaveBeenCalled()
    expect(mocks.legacyRole).not.toHaveBeenCalled()
  })

  it('denies organization administrators on platform-only routes', async () => {
    mocks.user.mockResolvedValueOnce({ ...user, role: 'admin' })
    const response = await withApi(
      { registry: { orgScoping: 'platform-admin-only' } },
      async () => ({ authorized: true }),
    )(request())
    expect(response.status).toBe(403)
  })

  it('permits canonical platform administrators on platform-only routes', async () => {
    mocks.user.mockResolvedValueOnce({ ...user, role: 'app_owner', isSystemAdmin: true })
    const response = await withApi(
      { registry: { orgScoping: 'platform-admin-only' } },
      async () => ({ authorized: true }),
    )(request())
    expect(response.status).toBe(200)
  })

  it('preserves explicitly unscoped password-profile handlers without tenant authority', async () => {
    mocks.user.mockResolvedValueOnce({ ...user, organizationId: null })
    const response = await withApi({ requireOrg: false }, async () => ({ profile: true }))(
      request(),
    )
    expect(response.status).toBe(200)
    expect(mocks.rls).not.toHaveBeenCalled()
  })

  it('rejects mismatched active transaction context instead of silently reusing it', async () => {
    mocks.active.mockReturnValueOnce({})
    mocks.context.mockResolvedValueOnce({ userId: user.id, orgId: 'foreign-organization' })
    const handler = vi.fn()
    const response = await withApi({}, handler)(request())
    expect(response.status).toBe(403)
    expect(handler).not.toHaveBeenCalled()
  })

  it('surfaces canonical membership denial as authentication denial', async () => {
    mocks.user.mockRejectedValueOnce(new AuthOrgBindingError('MEMBERSHIP_REQUIRED'))
    expect((await withApi({}, async () => ({}))(request())).status).toBe(401)
  })

  it('does not disguise database failures as missing authentication', async () => {
    mocks.user.mockRejectedValueOnce(new Error('synthetic database failure'))
    expect((await withApi({}, async () => ({}))(request())).status).toBe(500)
  })

  it('runs an opted-in case read and its RLS transaction before releasing the request binding', async () => {
    let bridgeLive = false
    mocks.requestScope.mockImplementationOnce(async callback => {
      bridgeLive = true
      try { return await callback() } finally { bridgeLive = false }
    })
    mocks.rls.mockImplementationOnce(async (_context, callback) => {
      expect(bridgeLive).toBe(true)
      const result = await callback()
      expect(bridgeLive).toBe(true) // transaction/deferred checks precede bridge revocation
      return result
    })
    const response = await withApi({ canonicalRequestScope: true }, async () => {
      expect(bridgeLive).toBe(true)
      return { own: true }
    })(request())
    expect(response.status).toBe(200)
    expect(mocks.requestScope).toHaveBeenCalledTimes(1)
    expect(mocks.rls).toHaveBeenCalledTimes(1)
    expect(bridgeLive).toBe(false)
  })

  it('fails closed when the opted-in request cannot establish live authority', async () => {
    const handler = vi.fn()
    mocks.requestScope.mockRejectedValueOnce(new AuthOrgBindingError('SESSION_AUTHORITY_REQUIRED'))
    expect((await withApi({ canonicalRequestScope: true }, handler)(request())).status).toBe(401)
    expect(handler).not.toHaveBeenCalled()
    expect(mocks.rls).not.toHaveBeenCalled()
  })

  it.each([{ auth: { required: false } }, { requireOrg: false }, { rlsOrgContext: false }])(
    'refuses request binding reuse without a bounded authenticated outer organization transaction: %j', options => {
      expect(() => withApi({ ...options, canonicalRequestScope: true }, async () => null)).toThrow('canonicalRequestScope requires')
    },
  )
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { resolveOrgContext, getFarmer360, warn } = vi.hoisted(() => ({
  warn: vi.fn(),
  resolveOrgContext: vi.fn(),
  getFarmer360: vi.fn(),
}))
vi.mock('@nzila/os-core/telemetry', () => ({ logger: { warn, error: vi.fn() } }))
vi.mock('@/lib/resolve-org', () => ({ resolveOrgContext }))
vi.mock('@/lib/farmer-360/service', () => ({
  createFarmer360Service: () => ({ getFarmer360 }),
}))
vi.mock('@/lib/farmer-360/adapters', () => ({
  createFarmer360RuntimePorts: () => ({}),
}))

import { GET } from './route'

const profileId = '40000000-0000-4000-8000-000000000002'

describe('Farmer 360 authenticated read route', () => {
  beforeEach(() => {
    resolveOrgContext.mockReset()
    getFarmer360.mockReset()
    resolveOrgContext.mockResolvedValue({
      orgId: '40000000-0000-4000-8000-000000000001',
      actorId: 'actor-1',
      appId: 'cora',
      role: 'viewer',
      permissions: ['cora:farmer360:read'],
      requestId: 'request-1',
      authorizationAudit: {
        event: 'application_authorization',
        decision: 'ALLOW',
        reason: 'AUTHORIZATION_CONTEXT_RESOLVED',
        platformUserId: 'actor-1',
        identityBindingId: 'binding-1',
        identityProvider: 'entra',
        externalIdentityReference: 'hashed-reference',
        organizationId: '40000000-0000-4000-8000-000000000001',
        membershipId: 'membership-1',
        applicationId: 'cora',
        permissionGrantIds: ['grant-1'],
        occurredAt: '2026-10-01T12:00:00.000Z',
        correlationId: 'request-1',
      },
    })
    getFarmer360.mockResolvedValue({ profile: { id: profileId }, sections: {}, gaps: [] })
  })

  it('rejects malformed profile IDs before querying the service', async () => {
    const response = await GET(new Request('http://localhost/api/farmer-360/not-a-uuid'), {
      params: Promise.resolve({ profileId: 'not-a-uuid' }),
    })

    expect(response.status).toBe(400)
    expect(response.headers.get('Cache-Control')).toContain('no-store')
    expect(getFarmer360).not.toHaveBeenCalled()
  })

  it('denies a malformed organization context before reading data', async () => {
    resolveOrgContext.mockResolvedValue({ permissions: ['cora:farmer360:read'] })
    const response = await GET(new Request('http://localhost/api/farmer-360/test'), {
      params: Promise.resolve({ profileId }),
    })
    expect(response.status).toBe(403)
    expect(getFarmer360).not.toHaveBeenCalled()
  })

  it('returns the org-scoped Farmer 360 read model', async () => {
    const response = await GET(new Request(`http://localhost/api/farmer-360/${profileId}`), {
      params: Promise.resolve({ profileId }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toContain('no-store')
    expect(response.headers.get('Pragma')).toBe('no-cache')
    expect(response.headers.get('Vary')).toBe('Cookie, Authorization')
    expect(getFarmer360).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: '40000000-0000-4000-8000-000000000001' }),
      profileId,
    )
  })

  it('returns unauthorized for an unauthenticated request', async () => {
    resolveOrgContext.mockRejectedValue(new Error('Unauthorized'))

    const response = await GET(new Request(`http://localhost/api/farmer-360/${profileId}`), {
      params: Promise.resolve({ profileId }),
    })

    expect(response.status).toBe(401)
    expect(response.headers.get('Cache-Control')).toContain('no-store')
    expect(getFarmer360).not.toHaveBeenCalled()
  })

  it('denies and logs a missing canonical Farmer 360 grant', async () => {
    const audit = {
      event: 'application_authorization',
      decision: 'ALLOW',
      reason: 'AUTHORIZATION_CONTEXT_RESOLVED',
      identityProvider: 'entra',
      externalIdentityReference: 'hashed-reference',
      applicationId: 'cora',
      occurredAt: '2026-10-01T12:00:00.000Z',
      correlationId: 'request-1',
    }
    resolveOrgContext.mockResolvedValue({
      orgId: '40000000-0000-4000-8000-000000000001',
      actorId: 'actor-1',
      appId: 'cora',
      role: 'viewer',
      permissions: [],
      requestId: 'request-1',
      authorizationAudit: audit,
    })

    const response = await GET(new Request(`http://localhost/api/farmer-360/${profileId}`), {
      params: Promise.resolve({ profileId }),
    })

    expect(response.status).toBe(403)
    expect(response.headers.get('Cache-Control')).toContain('no-store')
    expect(getFarmer360).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(
      '[CORA:AUTHZ:DENY]',
      expect.objectContaining({
        decision: 'DENY',
        reason: 'APPLICATION_PERMISSION_REQUIRED',
        externalIdentityReference: 'hashed-reference',
      }),
    )
    warn.mockClear()
  })
})

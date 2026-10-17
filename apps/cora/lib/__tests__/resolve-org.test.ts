import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockAuth = vi.fn()
const mockResolveAuthorizationContext = vi.fn()
vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: () => mockAuth(),
}))
vi.mock('@nzila/platform-auth/authorization-context', () => ({
  resolveAuthorizationContext: (input: unknown) => mockResolveAuthorizationContext(input),
}))

import { resolveOrgContext } from '../resolve-org'
import { locales, defaultLocale } from '../locales'

const resolvedContext = {
  platformUser: { id: 'platform-user-1', state: 'active' },
  identity: { bindingId: 'identity-1', provider: 'entra' },
  organization: { id: 'org-001' },
  membership: {
    id: 'membership-1',
    platformUserId: 'platform-user-1',
    organizationId: 'org-001',
    role: 'cooperative_manager',
    state: 'active',
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: null,
    organizationState: 'active',
  },
  applicationId: 'cora',
  permissions: ['cora:farmer360:read'],
  requestId: 'request-1',
  correlationId: 'correlation-1',
  audit: {
    event: 'application_authorization',
    decision: 'ALLOW',
    reason: 'AUTHORIZATION_CONTEXT_RESOLVED',
    platformUserId: 'platform-user-1',
    identityBindingId: 'identity-1',
    identityProvider: 'entra',
    externalIdentityReference: 'redacted-hash',
    organizationId: 'org-001',
    membershipId: 'membership-1',
    applicationId: 'cora',
    permissionGrantIds: ['grant-1'],
    occurredAt: '2026-01-02T00:00:00.000Z',
    correlationId: 'correlation-1',
  },
}

describe('resolveOrgContext', () => {
  beforeEach(() => {
    mockResolveAuthorizationContext.mockResolvedValue(resolvedContext)
  })

  it('rejects an unauthenticated request', async () => {
    mockAuth.mockResolvedValue({ userId: null })
    await expect(resolveOrgContext()).rejects.toThrow('Unauthorized')
    expect(mockResolveAuthorizationContext).not.toHaveBeenCalled()
  })

  it('rejects Union Eyes acceptance identity without reusing its token', async () => {
    mockAuth.mockResolvedValue({
      userId: 'ue-user',
      identityProvider: 'union-eyes-acceptance',
      providerSubject: null,
    })
    await expect(resolveOrgContext()).rejects.toThrow('Unauthorized')
    expect(mockResolveAuthorizationContext).not.toHaveBeenCalled()
  })

  it('fails closed when provider identity metadata is absent', async () => {
    mockAuth.mockResolvedValue({ userId: 'session-user', orgId: 'org-from-claim' })
    await expect(resolveOrgContext()).rejects.toThrow('Unauthorized')
    expect(mockResolveAuthorizationContext).not.toHaveBeenCalled()
  })

  it('resolves identity, membership, role, and permissions from platform authority', async () => {
    mockAuth.mockResolvedValue({
      userId: 'provider-session-id',
      orgId: 'group-claim-org',
      orgRole: 'org:admin',
      identityProvider: 'entra',
      providerSubject: 'tenant-1:entra-object-1',
      orgSelectionSource: 'entra-group-legacy',
      sessionClaims: { roles: ['admin'], publicMetadata: { agriRole: 'admin' } },
    })

    const context = await resolveOrgContext()

    expect(mockResolveAuthorizationContext).toHaveBeenCalledWith({
      identityProvider: 'entra',
      providerSubject: 'tenant-1:entra-object-1',
      applicationId: 'cora',
      requestedOrganizationId: undefined,
      requestId: undefined,
      correlationId: undefined,
    })
    expect(context).toMatchObject({
      orgId: 'org-001',
      actorId: 'platform-user-1',
      role: 'manager',
      membershipRoleSource: 'canonical',
      permissions: ['cora:farmer360:read'],
      appId: 'cora',
      membershipId: 'membership-1',
      identityProvider: 'entra',
    })
    expect(context.actorId).not.toBe('provider-session-id')
  })

  it('does not use a legacy default membership as selected organization authority', async () => {
    mockAuth.mockResolvedValue({
      userId: 'user-1',
      orgId: 'legacy-first-org',
      identityProvider: 'nzila-password',
      providerSubject: 'person@example.com',
      orgSelectionSource: 'legacy-membership-default',
    })

    await resolveOrgContext()
    expect(mockResolveAuthorizationContext).toHaveBeenCalledWith(
      expect.objectContaining({ requestedOrganizationId: undefined }),
    )
  })

  it('passes only an explicit Cora organization selection for membership verification', async () => {
    mockAuth.mockResolvedValue({
      userId: 'user-1',
      identityProvider: 'entra',
      providerSubject: 'tenant-1:object-1',
    })

    await resolveOrgContext({ requestedOrganizationId: 'org-requested' })
    expect(mockResolveAuthorizationContext).toHaveBeenCalledWith(
      expect.objectContaining({ requestedOrganizationId: 'org-requested' }),
    )
  })

  it('preserves the application authorization audit metadata', async () => {
    mockAuth.mockResolvedValue({
      userId: 'user-1',
      identityProvider: 'entra',
      providerSubject: 'tenant-1:object-1',
    })
    const context = await resolveOrgContext()
    expect(context.authorizationAudit).toEqual(resolvedContext.audit)
  })

  it('defaults unknown canonical membership roles to viewer without changing permissions', async () => {
    mockAuth.mockResolvedValue({
      userId: 'user-1',
      identityProvider: 'nzila-password',
      providerSubject: 'person@example.com',
    })
    mockResolveAuthorizationContext.mockResolvedValue({
      ...resolvedContext,
      membership: { ...resolvedContext.membership, role: 'unrecognized' },
      permissions: [],
    })

    const context = await resolveOrgContext()
    expect(context.role).toBe('viewer')
    expect(context.membershipRoleSource).toBe('fallback')
    expect(context.permissions).toEqual([])
  })

  it('does not derive source-disclosure role eligibility from provider role claims', async () => {
    mockAuth.mockResolvedValue({
      userId: 'user-1',
      identityProvider: 'entra',
      providerSubject: 'tenant-1:object-1',
      orgRole: 'org:admin',
      sessionClaims: { roles: ['admin'], publicMetadata: { agriRole: 'admin' } },
    })
    mockResolveAuthorizationContext.mockResolvedValue({
      ...resolvedContext,
      membership: { ...resolvedContext.membership, role: 'unknown-provider-role' },
    })

    const context = await resolveOrgContext()

    expect(context.role).toBe('viewer')
    expect(context.membershipRoleSource).toBe('fallback')
  })

  it('exports locale constants', () => {
    expect(locales).toEqual(['en-CA', 'fr-CA'])
    expect(defaultLocale).toBe('en-CA')
  })
})

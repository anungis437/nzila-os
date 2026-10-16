import { describe, expect, it } from 'vitest'
import {
  AuthorizationResolutionError,
  resolveAuthorizationContextWithStore,
  withholdUnresolvedEvidenceRead,
  type ApplicationPermissionGrant,
  type AuthorizationAuthorityStore,
  type AuthorizationResolutionInput,
  type ExternalIdentityBinding,
  type OrganizationMembership,
} from './authorization-context'

const now = new Date('2026-10-01T12:00:00.000Z')
const future = new Date('2026-10-02T12:00:00.000Z')
const past = new Date('2026-09-30T12:00:00.000Z')

const binding = (overrides: Partial<ExternalIdentityBinding> = {}): ExternalIdentityBinding => ({
  id: 'binding-a',
  provider: 'entra',
  providerSubject: 'tenant-a:subject-a',
  platformUserId: 'user-a',
  state: 'active',
  verifiedAt: past,
  principal: { id: 'user-a', state: 'active' },
  ...overrides,
})

const membership = (overrides: Partial<OrganizationMembership> = {}): OrganizationMembership => ({
  id: 'membership-a',
  platformUserId: 'user-a',
  organizationId: 'org-a',
  role: 'org_viewer',
  state: 'active',
  effectiveFrom: past,
  effectiveTo: null,
  organizationState: 'active',
  ...overrides,
})

const grant = (
  overrides: Partial<ApplicationPermissionGrant> = {},
): ApplicationPermissionGrant => ({
  id: 'grant-a',
  membershipId: 'membership-a',
  organizationId: 'org-a',
  applicationId: 'cora',
  permission: 'cora:farmer360:read',
  state: 'active',
  effectiveFrom: past,
  expiresAt: null,
  ...overrides,
})

function store(
  options: {
    bindings?: Readonly<Record<string, ExternalIdentityBinding>>
    memberships?: readonly OrganizationMembership[]
    grants?: readonly ApplicationPermissionGrant[]
  } = {},
): AuthorizationAuthorityStore {
  const bindings = options.bindings ?? {
    'entra\u0000tenant-a:subject-a': binding(),
    'entra\u0000tenant-b:subject-a': binding({
      id: 'binding-b',
      providerSubject: 'tenant-b:subject-a',
      platformUserId: 'user-b',
      principal: { id: 'user-b', state: 'active' },
    }),
    'nzila-password\u0000user-a': binding({
      id: 'binding-password',
      provider: 'nzila-password',
      providerSubject: 'user-a',
    }),
  }

  return {
    async findIdentityBinding(provider, providerSubject) {
      return bindings[`${provider}\u0000${providerSubject}`] ?? null
    },
    async listMemberships(platformUserId) {
      return (options.memberships ?? [membership()]).filter(
        (item) => item.platformUserId === platformUserId,
      )
    },
    async listPermissionGrants(membershipId, organizationId, applicationId) {
      return (options.grants ?? [grant()]).filter(
        (item) =>
          item.membershipId === membershipId &&
          item.organizationId === organizationId &&
          item.applicationId === applicationId,
      )
    },
  }
}

const input: AuthorizationResolutionInput = {
  identityProvider: 'entra',
  providerSubject: 'tenant-a:subject-a',
  applicationId: 'cora',
  requestedOrganizationId: undefined,
  requestId: 'request-a',
}

async function expectDenied(
  code: AuthorizationResolutionError['code'],
  inputOverrides: Partial<typeof input> = {},
  storeOverrides: Parameters<typeof store>[0] = {},
) {
  await expect(
    resolveAuthorizationContextWithStore(
      { ...input, ...inputOverrides },
      store(storeOverrides),
      now,
    ),
  ).rejects.toMatchObject({ code })
}

describe('canonical platform authorization resolution', () => {
  it('resolves a verified provider subject to the bound platform principal', async () => {
    const context = await resolveAuthorizationContextWithStore(input, store(), now)
    expect(context.platformUser.id).toBe('user-a')
    expect(context.identity.bindingId).toBe('binding-a')
    expect(context.identity.provider).toBe('entra')
  })

  it('denies an unknown provider subject', async () => {
    await expectDenied('IDENTITY_NOT_BOUND', { providerSubject: 'unknown' })
  })

  it.each(['disabled', 'revoked'] as const)('denies a %s identity binding', async (state) => {
    const inactive = binding({ state })
    await expectDenied(
      'IDENTITY_BINDING_INACTIVE',
      {},
      {
        bindings: { 'entra\u0000tenant-a:subject-a': inactive },
      },
    )
  })

  it('denies a binding that is not yet verified', async () => {
    await expectDenied(
      'IDENTITY_BINDING_INACTIVE',
      {},
      {
        bindings: {
          'entra\u0000tenant-a:subject-a': binding({ verifiedAt: future }),
        },
      },
    )
  })

  it('denies an inactive platform user', async () => {
    await expectDenied(
      'PLATFORM_USER_INACTIVE',
      {},
      {
        bindings: {
          'entra\u0000tenant-a:subject-a': binding({
            principal: { id: 'user-a', state: 'deprovisioned' },
          }),
        },
      },
    )
  })

  it('keeps provider namespaces isolated for identical subject strings', async () => {
    const context = await resolveAuthorizationContextWithStore(
      { ...input, identityProvider: 'nzila-password', providerSubject: 'user-a' },
      store(),
      now,
    )
    expect(context.platformUser.id).toBe('user-a')
    expect(context.identity.bindingId).toBe('binding-password')
    await expectDenied('IDENTITY_NOT_BOUND', {
      identityProvider: 'entra',
      providerSubject: 'user-a',
    })
  })

  it('accepts an active, effective membership and checks the requested org', async () => {
    const context = await resolveAuthorizationContextWithStore(
      { ...input, requestedOrganizationId: 'org-a' },
      store(),
      now,
    )
    expect(context.membership.id).toBe('membership-a')
    expect(context.organization.id).toBe('org-a')
  })

  it.each(['invited', 'suspended', 'revoked'] as const)(
    'denies a %s membership when explicitly requested',
    async (state) => {
      await expectDenied(
        'MEMBERSHIP_NOT_ACTIVE',
        { requestedOrganizationId: 'org-a' },
        {
          memberships: [membership({ state })],
        },
      )
    },
  )

  it('denies missing membership', async () => {
    await expectDenied('MEMBERSHIP_REQUIRED', {}, { memberships: [] })
  })

  it('denies a requested organization the user does not belong to', async () => {
    await expectDenied('MEMBERSHIP_REQUIRED', { requestedOrganizationId: 'org-b' })
  })

  it('denies inactive organizations', async () => {
    await expectDenied(
      'ORGANIZATION_INACTIVE',
      { requestedOrganizationId: 'org-a' },
      {
        memberships: [membership({ organizationState: 'inactive' })],
      },
    )
  })

  it('does not choose the first of multiple active memberships', async () => {
    await expectDenied(
      'AMBIGUOUS_ORGANIZATION',
      {},
      {
        memberships: [membership(), membership({ id: 'membership-b', organizationId: 'org-b' })],
      },
    )
  })

  it('accepts explicit selection from multiple active memberships', async () => {
    const context = await resolveAuthorizationContextWithStore(
      { ...input, requestedOrganizationId: 'org-b' },
      store({
        memberships: [membership(), membership({ id: 'membership-b', organizationId: 'org-b' })],
        grants: [
          grant(),
          grant({
            id: 'grant-b',
            membershipId: 'membership-b',
            organizationId: 'org-b',
          }),
        ],
      }),
      now,
    )
    expect(context.organization.id).toBe('org-b')
  })

  it('returns only explicit, effective grants for the requested application', async () => {
    const context = await resolveAuthorizationContextWithStore(
      input,
      store({
        grants: [
          grant(),
          grant({ id: 'grant-revoked', permission: 'cora:read', state: 'revoked' }),
          grant({ id: 'grant-expired', permission: 'cora:expired', expiresAt: past }),
          grant({ id: 'grant-future', permission: 'cora:future', effectiveFrom: future }),
          grant({
            id: 'grant-cross-app',
            applicationId: 'union-eyes',
            permission: 'union-eyes:case:read',
          }),
          grant({ id: 'grant-bad-scope', permission: 'union-eyes:case:read' }),
          grant({ id: 'grant-wildcard', permission: 'cora:*' }),
        ],
      }),
      now,
    )
    expect(context.permissions).toEqual(['cora:farmer360:read'])
    expect(context.audit.permissionGrantIds).toEqual(['grant-a'])
  })

  it('does not inherit Cora grants into Union Eyes', async () => {
    const context = await resolveAuthorizationContextWithStore(
      { ...input, applicationId: 'union-eyes' },
      store(),
      now,
    )
    expect(context.permissions).toEqual([])
  })

  it('does not inherit Union Eyes grants into Cora', async () => {
    const context = await resolveAuthorizationContextWithStore(
      input,
      store({
        grants: [
          grant({
            id: 'ue-only',
            applicationId: 'union-eyes',
            permission: 'union-eyes:case:read',
          }),
        ],
      }),
      now,
    )
    expect(context.permissions).toEqual([])
  })

  it('fails closed when a required application permission is missing', async () => {
    await expectDenied(
      'APPLICATION_PERMISSION_REQUIRED',
      { requiredPermissions: ['cora:farmer360:read'] },
      {
        grants: [
          grant({
            id: 'other-grant',
            permission: 'cora:enterprise-context:read',
          }),
        ],
      },
    )
  })

  it('accepts required permissions only from effective canonical grants', async () => {
    const context = await resolveAuthorizationContextWithStore(
      { ...input, requiredPermissions: ['cora:farmer360:read'] },
      store(),
      now,
    )
    expect(context.audit.requiredPermissions).toEqual(['cora:farmer360:read'])
    expect(context.audit.effectivePermissions).toEqual(['cora:farmer360:read'])
  })

  it('rejects invalid and ambiguous organization input rather than guessing', async () => {
    await expectDenied('INVALID_AUTHORIZATION_INPUT', { requestedOrganizationId: ' ' })
    await expectDenied('INVALID_AUTHORIZATION_INPUT', { applicationId: 'Cora' })
  })

  it('emits denial audit metadata with a hashed identity reference, never the subject', async () => {
    try {
      await resolveAuthorizationContextWithStore(
        { ...input, providerSubject: 'token-like-secret' },
        store(),
        now,
      )
      throw new Error('Expected identity resolution to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(AuthorizationResolutionError)
      if (!(error instanceof AuthorizationResolutionError)) throw error
      expect(error.audit.decision).toBe('DENY')
      expect(error.audit.externalIdentityReference).not.toContain('token-like-secret')
      expect(error.audit.correlationId).toBe('request-a')
    }
  })

  it('withholds evidence when no generic grant/consent decision is configured', () => {
    const context = resolveFixtureContext()
    const decision = withholdUnresolvedEvidenceRead({
      authorizationContext: context,
      authorityClass: 'SUBJECT_CONTROLLED',
      resource: { id: 'evidence-a', organizationId: 'org-a' },
      subject: { id: 'subject-a', type: 'farmer' },
      purpose: 'farmer-profile-read',
      recipientContext: 'cora',
    })
    expect(decision.decision).toBe('WITHHOLD')
    expect(decision.reason).toBe('GENERIC_GRANT_MODEL_REQUIRED')
    expect(decision.audit.resourceId).toBe('evidence-a')
  })
})

function resolveFixtureContext() {
  return {
    platformUser: { id: 'user-a', state: 'active' as const },
    identity: { bindingId: 'binding-a', provider: 'entra' },
    organization: { id: 'org-a' },
    membership: membership(),
    applicationId: 'cora',
    permissions: ['cora:farmer360:read'],
    requestId: 'request-a',
    correlationId: 'request-a',
    audit: {
      event: 'application_authorization' as const,
      decision: 'ALLOW' as const,
      reason: 'AUTHORIZATION_CONTEXT_RESOLVED',
      platformUserId: 'user-a',
      identityBindingId: 'binding-a',
      identityProvider: 'entra',
      externalIdentityReference: 'reference',
      organizationId: 'org-a',
      membershipId: 'membership-a',
      applicationId: 'cora',
      permissionGrantIds: ['grant-a'],
      occurredAt: now.toISOString(),
      correlationId: 'request-a',
    },
  }
}

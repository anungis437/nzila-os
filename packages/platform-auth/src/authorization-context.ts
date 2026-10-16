import { createHash, randomUUID } from 'node:crypto'

export type IdentityBindingState = 'active' | 'disabled' | 'revoked'
export type PlatformMembershipState = 'active' | 'invited' | 'suspended' | 'revoked'
export type PermissionGrantState = 'active' | 'revoked'

export interface PlatformPrincipal {
  readonly id: string
  readonly state: 'active' | 'suspended' | 'deprovisioned'
}

export interface ExternalIdentityBinding {
  readonly id: string
  readonly provider: string
  readonly providerSubject: string
  readonly platformUserId: string
  readonly state: IdentityBindingState
  readonly verifiedAt: Date
  readonly principal: PlatformPrincipal
}

export interface OrganizationMembership {
  readonly id: string
  readonly platformUserId: string
  readonly organizationId: string
  readonly role: string
  readonly state: PlatformMembershipState
  readonly effectiveFrom: Date
  readonly effectiveTo: Date | null
  readonly organizationState: 'active' | 'inactive'
}

export interface ApplicationPermissionGrant {
  readonly id: string
  readonly membershipId: string
  readonly organizationId: string
  readonly applicationId: string
  readonly permission: string
  readonly state: PermissionGrantState
  readonly effectiveFrom: Date
  readonly expiresAt: Date | null
}

export interface AuthorizationAuditMetadata {
  readonly event: 'application_authorization'
  readonly decision: 'ALLOW' | 'DENY'
  readonly reason: string
  readonly platformUserId?: string
  readonly identityBindingId?: string
  readonly identityProvider: string
  readonly externalIdentityReference: string
  readonly organizationId?: string
  readonly membershipId?: string
  readonly applicationId: string
  readonly requiredPermissions?: readonly string[]
  readonly effectivePermissions?: readonly string[]
  readonly permissionGrantIds?: readonly string[]
  readonly occurredAt: string
  readonly correlationId: string
}

export interface AuthorizationContext {
  readonly platformUser: PlatformPrincipal
  readonly identity: {
    readonly bindingId: string
    readonly provider: string
  }
  readonly organization: { readonly id: string }
  readonly membership: OrganizationMembership
  readonly applicationId: string
  readonly permissions: readonly string[]
  readonly requestId: string
  readonly correlationId: string
  readonly audit: AuthorizationAuditMetadata
}

export interface AuthorizationResolutionInput {
  readonly identityProvider: string
  readonly providerSubject: string
  readonly applicationId: string
  readonly requiredPermissions?: readonly string[]
  readonly requestedOrganizationId?: string | null
  readonly requestId?: string
  readonly correlationId?: string
}

export interface AuthorizationAuthorityStore {
  findIdentityBinding(
    provider: string,
    providerSubject: string,
  ): Promise<ExternalIdentityBinding | null>
  listMemberships(platformUserId: string): Promise<readonly OrganizationMembership[]>
  listPermissionGrants(
    membershipId: string,
    organizationId: string,
    applicationId: string,
  ): Promise<readonly ApplicationPermissionGrant[]>
}

export type AuthorizationFailureCode =
  | 'INVALID_AUTHORIZATION_INPUT'
  | 'IDENTITY_NOT_BOUND'
  | 'IDENTITY_BINDING_INACTIVE'
  | 'PLATFORM_USER_INACTIVE'
  | 'MEMBERSHIP_REQUIRED'
  | 'MEMBERSHIP_NOT_ACTIVE'
  | 'ORGANIZATION_INACTIVE'
  | 'AMBIGUOUS_ORGANIZATION'
  | 'APPLICATION_PERMISSION_REQUIRED'

export class AuthorizationResolutionError extends Error {
  constructor(
    readonly code: AuthorizationFailureCode,
    readonly audit: AuthorizationAuditMetadata,
  ) {
    super(code)
    this.name = 'AuthorizationResolutionError'
  }
}

function createAuditMetadata(
  input: AuthorizationResolutionInput,
  reason: string,
): AuthorizationAuditMetadata {
  const requestId = input.requestId ?? randomUUID()
  return {
    event: 'application_authorization',
    decision: 'DENY',
    reason,
    identityProvider: input.identityProvider,
    externalIdentityReference: createHash('sha256')
      .update(`${input.identityProvider}\u0000${input.providerSubject}`)
      .digest('hex'),
    applicationId: input.applicationId,
    occurredAt: new Date().toISOString(),
    correlationId: input.correlationId ?? requestId,
  }
}

function fail(
  input: AuthorizationResolutionInput,
  code: AuthorizationFailureCode,
  reason = code,
  details: Partial<AuthorizationAuditMetadata> = {},
): never {
  const audit = { ...createAuditMetadata(input, reason), ...details, reason }
  throw new AuthorizationResolutionError(code, audit)
}

function isEffective(from: Date, to: Date | null, at: Date): boolean {
  return from.getTime() <= at.getTime() && (to === null || to.getTime() > at.getTime())
}

function validateInput(input: AuthorizationResolutionInput): void {
  const provider = input.identityProvider.trim().toLowerCase()
  const applicationId = input.applicationId.trim().toLowerCase()
  if (
    !/^[a-z0-9][a-z0-9._-]{0,79}$/.test(provider) ||
    provider !== input.identityProvider ||
    input.providerSubject.trim().length === 0 ||
    input.providerSubject.length > 512 ||
    !/^[a-z0-9][a-z0-9._-]{0,79}$/.test(applicationId) ||
    applicationId !== input.applicationId ||
    input.requiredPermissions?.some(
      (permission) =>
        !permission.startsWith(`${input.applicationId}:`) ||
        permission.includes('*') ||
        permission.length > 160,
    ) ||
    (input.requestedOrganizationId !== undefined &&
      input.requestedOrganizationId !== null &&
      input.requestedOrganizationId.trim().length === 0)
  ) {
    fail(input, 'INVALID_AUTHORIZATION_INPUT')
  }
}

export async function resolveAuthorizationContextWithStore(
  input: AuthorizationResolutionInput,
  store: AuthorizationAuthorityStore,
  now = new Date(),
): Promise<AuthorizationContext> {
  validateInput(input)
  const binding = await store.findIdentityBinding(input.identityProvider, input.providerSubject)
  if (!binding) fail(input, 'IDENTITY_NOT_BOUND')
  if (binding.state !== 'active' || binding.verifiedAt.getTime() > now.getTime()) {
    fail(input, 'IDENTITY_BINDING_INACTIVE', 'IDENTITY_BINDING_INACTIVE', {
      platformUserId: binding.platformUserId,
      identityBindingId: binding.id,
    })
  }
  if (binding.principal.state !== 'active' || binding.principal.id !== binding.platformUserId) {
    fail(input, 'PLATFORM_USER_INACTIVE', 'PLATFORM_USER_INACTIVE', {
      platformUserId: binding.platformUserId,
      identityBindingId: binding.id,
    })
  }

  const memberships = await store.listMemberships(binding.platformUserId)
  const activeMemberships = memberships.filter(
    (membership) =>
      membership.platformUserId === binding.platformUserId &&
      membership.state === 'active' &&
      membership.organizationState === 'active' &&
      isEffective(membership.effectiveFrom, membership.effectiveTo, now),
  )

  let membership: OrganizationMembership
  if (input.requestedOrganizationId) {
    const requestedMembership = memberships.find(
      (candidate) => candidate.organizationId === input.requestedOrganizationId,
    )
    if (requestedMembership?.organizationState === 'inactive') {
      fail(input, 'ORGANIZATION_INACTIVE', 'ORGANIZATION_INACTIVE', {
        platformUserId: binding.platformUserId,
        identityBindingId: binding.id,
        organizationId: input.requestedOrganizationId,
        membershipId: requestedMembership.id,
      })
    }
    const activeRequested = activeMemberships.find(
      (candidate) => candidate.organizationId === input.requestedOrganizationId,
    )
    if (!activeRequested) {
      fail(
        input,
        requestedMembership ? 'MEMBERSHIP_NOT_ACTIVE' : 'MEMBERSHIP_REQUIRED',
        undefined,
        {
          platformUserId: binding.platformUserId,
          identityBindingId: binding.id,
          membershipId: requestedMembership?.id,
        },
      )
    }
    membership = activeRequested
  } else if (activeMemberships.length === 0) {
    fail(input, 'MEMBERSHIP_REQUIRED', undefined, {
      platformUserId: binding.platformUserId,
      identityBindingId: binding.id,
    })
  } else if (activeMemberships.length > 1) {
    fail(input, 'AMBIGUOUS_ORGANIZATION', undefined, {
      platformUserId: binding.platformUserId,
      identityBindingId: binding.id,
    })
  } else {
    membership = activeMemberships[0]
  }

  const grants = await store.listPermissionGrants(
    membership.id,
    membership.organizationId,
    input.applicationId,
  )
  const effectiveGrants = grants.filter(
    (grant) =>
      grant.membershipId === membership.id &&
      grant.organizationId === membership.organizationId &&
      grant.applicationId === input.applicationId &&
      grant.state === 'active' &&
      grant.permission.startsWith(`${input.applicationId}:`) &&
      !grant.permission.includes('*') &&
      isEffective(grant.effectiveFrom, grant.expiresAt, now),
  )
  const permissions = [...new Set(effectiveGrants.map((grant) => grant.permission))].sort()
  const requiredPermissions = [...new Set(input.requiredPermissions ?? [])].sort()
  const missingPermissions = requiredPermissions.filter(
    (permission) => !permissions.includes(permission),
  )
  if (missingPermissions.length > 0) {
    fail(input, 'APPLICATION_PERMISSION_REQUIRED', 'APPLICATION_PERMISSION_REQUIRED', {
      platformUserId: binding.platformUserId,
      identityBindingId: binding.id,
      organizationId: membership.organizationId,
      membershipId: membership.id,
      requiredPermissions,
      effectivePermissions: permissions,
      permissionGrantIds: effectiveGrants.map((grant) => grant.id),
    })
  }
  const requestId = input.requestId ?? randomUUID()
  const correlationId = input.correlationId ?? requestId
  const audit: AuthorizationAuditMetadata = {
    event: 'application_authorization',
    decision: 'ALLOW',
    reason: 'AUTHORIZATION_CONTEXT_RESOLVED',
    platformUserId: binding.platformUserId,
    identityBindingId: binding.id,
    identityProvider: binding.provider,
    externalIdentityReference: createHash('sha256')
      .update(`${binding.provider}\u0000${binding.providerSubject}`)
      .digest('hex'),
    organizationId: membership.organizationId,
    membershipId: membership.id,
    applicationId: input.applicationId,
    requiredPermissions,
    effectivePermissions: permissions,
    permissionGrantIds: effectiveGrants.map((grant) => grant.id),
    occurredAt: now.toISOString(),
    correlationId,
  }

  return {
    platformUser: binding.principal,
    identity: { bindingId: binding.id, provider: binding.provider },
    organization: { id: membership.organizationId },
    membership,
    applicationId: input.applicationId,
    permissions,
    requestId,
    correlationId,
    audit,
  }
}

export async function resolveAuthorizationContext(
  input: AuthorizationResolutionInput,
): Promise<AuthorizationContext> {
  const { writeAuthorizationDecision } = await import('@nzila/db/authorization-audit')
  const { platformAuthorizationStore } = await import('./authorization-store')
  let context: AuthorizationContext
  try {
    context = await resolveAuthorizationContextWithStore(input, platformAuthorizationStore)
  } catch (error) {
    if (!(error instanceof AuthorizationResolutionError)) throw error
    await writeAuthorizationDecision(error.audit)
    throw error
  }
  await writeAuthorizationDecision(context.audit)
  return context
}

export type EvidenceAuthorityClass =
  | 'ORG_OWNED_INTERNAL'
  | 'SUBJECT_CONTROLLED'
  | 'EXTERNALLY_LICENSED'
  | 'AGGREGATED'
  | 'PUBLIC_OPEN'
  | 'RESTRICTED'

export interface EvidenceReadAuthorityInput {
  readonly authorizationContext: AuthorizationContext
  readonly authorityClass: EvidenceAuthorityClass
  readonly resource: { readonly id: string; readonly organizationId?: string }
  readonly subject?: { readonly id: string; readonly type?: string }
  readonly purpose: string
  readonly recipientContext?: string
  readonly grantConsentReference?: string
  readonly policyReference?: string
}

export interface EvidenceReadAuthorityDecision {
  readonly decision: 'ALLOW' | 'DENY' | 'WITHHOLD'
  readonly reason: string
  readonly audit: {
    readonly actorId: string
    readonly organizationId: string
    readonly applicationId: string
    readonly resourceId: string
    readonly authorityClass: EvidenceAuthorityClass
    readonly purpose: string
    readonly recipientContext?: string
    readonly grantConsentReference?: string
    readonly policyReference?: string
    readonly correlationId: string
    readonly occurredAt: string
  }
}

export function withholdUnresolvedEvidenceRead(
  input: EvidenceReadAuthorityInput,
  reason = 'GENERIC_GRANT_MODEL_REQUIRED',
): EvidenceReadAuthorityDecision {
  return {
    decision: 'WITHHOLD',
    reason,
    audit: {
      actorId: input.authorizationContext.platformUser.id,
      organizationId: input.authorizationContext.organization.id,
      applicationId: input.authorizationContext.applicationId,
      resourceId: input.resource.id,
      authorityClass: input.authorityClass,
      purpose: input.purpose,
      recipientContext: input.recipientContext,
      grantConsentReference: input.grantConsentReference,
      policyReference: input.policyReference,
      correlationId: input.authorizationContext.correlationId,
      occurredAt: new Date().toISOString(),
    },
  }
}

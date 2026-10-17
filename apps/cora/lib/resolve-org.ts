/**
 * Cora authorization context resolved from canonical NzilaOS authority.
 *
 * Provider claims supply identity signals only. Organization and permissions
 * come from the platform-owned binding, membership, and grant records.
 */
import { resolveAuthorizationContext } from '@nzila/platform-auth/authorization-context'
import type {
  AuthorizationAuditMetadata,
  AuthorizationContext,
} from '@nzila/platform-auth/authorization-context'
import type { AgriOrgContext, AgriOrgRole } from '@nzila/agri-core'

export interface CoraAuthorizationContext extends AgriOrgContext {
  readonly appId: 'cora'
  readonly identityBindingId: string
  readonly identityBindingState: 'active'
  readonly membershipRoleSource: 'canonical' | 'fallback'
  readonly membershipId: string
  readonly membershipState: 'active'
  readonly identityProvider: string
  readonly correlationId: string
  readonly authorizationAudit: AuthorizationAuditMetadata
}

export interface ResolveOrgContextOptions {
  /** Must be an application-supplied selection, never a provider group claim. */
  readonly requestedOrganizationId?: string
  readonly requiredPermissions?: readonly string[]
  readonly requestId?: string
  readonly correlationId?: string
}

export interface CoraIdentitySignals {
  readonly identityProvider: string
  readonly providerSubject: string
}

export async function resolveOrgContext(
  options: ResolveOrgContextOptions = {},
): Promise<CoraAuthorizationContext> {
  const { auth } = await import('@nzila/platform-auth/entra/server')
  const session = await auth()
  if (!session.userId) throw new Error('Unauthorized')
  if (
    session.identityProvider === 'union-eyes-acceptance' ||
    !session.identityProvider ||
    !session.providerSubject
  ) {
    throw new Error('Unauthorized')
  }

  return resolveOrgContextFromIdentity(
    {
      identityProvider: session.identityProvider,
      providerSubject: session.providerSubject,
    },
    options,
  )
}

export async function resolveOrgContextFromIdentity(
  identity: CoraIdentitySignals,
  options: ResolveOrgContextOptions = {},
): Promise<CoraAuthorizationContext> {
  const context = await resolveAuthorizationContext({
    identityProvider: identity.identityProvider,
    providerSubject: identity.providerSubject,
    applicationId: 'cora',
    requestedOrganizationId: options.requestedOrganizationId,
    ...(options.requiredPermissions ? { requiredPermissions: options.requiredPermissions } : {}),
    requestId: options.requestId,
    correlationId: options.correlationId,
  })

  return toCoraContext(context)
}

function toCoraContext(context: AuthorizationContext): CoraAuthorizationContext {
  const membershipRoleSource = isCanonicalMembershipRole(context.membership.role)
    ? 'canonical'
    : 'fallback'
  return {
    orgId: context.organization.id,
    actorId: context.platformUser.id,
    appId: 'cora',
    identityBindingId: context.identity.bindingId,
    identityBindingState: 'active',
    role: mapMembershipRole(context.membership.role),
    membershipRoleSource,
    permissions: context.permissions,
    requestId: context.requestId,
    membershipId: context.membership.id,
    membershipState: 'active',
    identityProvider: context.identity.provider,
    correlationId: context.correlationId,
    authorizationAudit: context.audit,
  }
}

function isCanonicalMembershipRole(role: string): boolean {
  switch (role) {
    case 'admin':
    case 'org_admin':
    case 'cooperative_manager':
    case 'field_agent':
    case 'warehouse_manager':
    case 'buyer':
    case 'viewer':
      return true
    default:
      return false
  }
}

function mapMembershipRole(role: string): AgriOrgRole {
  switch (role) {
    case 'admin':
    case 'org_admin':
      return 'admin'
    case 'cooperative_manager':
      return 'manager'
    case 'field_agent':
    case 'warehouse_manager':
    case 'buyer':
      return 'operator'
    default:
      return 'viewer'
  }
}

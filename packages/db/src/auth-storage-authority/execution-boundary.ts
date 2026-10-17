/**
 * Prospective, bounded execution authority; not a claim about deployed grants.
 * Preidentity email/token selectors are credentials to LOOK UP, not user identity.
 */
export const AUTH_EXECUTION_ROLES = {
  gateway: 'nzila_auth_gateway',
  lookup: 'nzila_auth_lookup',
  identity: 'nzila_auth_identity',
  systemGateway: 'nzila_auth_system_gateway',
  system: 'nzila_auth_system_mutation',
  riskReader: 'nzila_auth_risk_aggregate',
  issuance: 'nzila_auth_issuance',
  redemption: 'nzila_auth_redemption',
  tenantAdmin: 'nzila_auth_tenant_admin',
  provider: 'nzila_auth_provider',
  providerReader: 'nzila_auth_provider_reader',
  lifecycle: 'nzila_auth_lifecycle',
  cleanup: 'nzila_auth_cleanup',
  mfaAdmin: 'nzila_auth_mfa_admin',
  audit: 'nzila_auth_audit_writer',
  orgAuthorityReader: 'nzila_auth_org_authority_reader',
} as const

export type AuthLookup =
  | { kind: 'email'; email: string }
  | { kind: 'session' | 'reset' | 'magic-link' | 'invite' | 'mfa'; tokenHash: string }

export type AuthExecutionContext =
  | { phase: 'audit'; channel: 'cora-acceptance' }
  | { phase: 'lookup'; selector: AuthLookup }
  | { phase: 'identity'; userId: string }
  | { phase: 'issuance'; operation: 'signup' | 'reset-issue' | 'magic-issue' | 'policy-discovery'; email: string; ipAddress?: string; organizationId?: string | null }
  | { phase: 'redemption'; selector: { kind: 'reset' | 'magic-link' | 'invite' | 'mfa'; tokenHash: string } }
  | { phase: 'tenant-admin'; userId: string; organizationId: string }
  | { phase: 'provider'; provider: string; providerSubject: string }
  | { phase: 'lifecycle'; actorUserId: string; targetUserId: string; operation: 'suspend' | 'reactivate' | 'deprovision'; reason: string }
  | { phase: 'cleanup'; actorUserId: string; reason: string }
  | { phase: 'mfa-admin'; actorUserId: string; targetUserId: string; reason: string }
  | {
      phase: 'system'
      actorUserId: string
      targetUserId: string
      operation: 'revoke-sessions' | 'membership-state'
      organizationId?: string
      reason: string
    }

export function authContextSettings(context: AuthExecutionContext): Record<string, string> {
  const settings = {
    'nzila.auth_phase': context.phase,
    'nzila.auth_selector': '',
    'nzila.auth_email': '',
    'nzila.auth_token_hash': '',
    'nzila.auth_user_id': '',
    'nzila.auth_actor_id': '',
    'nzila.auth_org_id': '',
    'nzila.auth_operation': '',
    'nzila.auth_reason': '',
    'nzila.auth_ip': '',
    'nzila.auth_provider': '',
    'nzila.auth_provider_subject': '',
  }
  if (context.phase === 'audit') {
    if (context.channel !== 'cora-acceptance') throw new Error('Unsupported auth audit channel')
    settings['nzila.auth_provider'] = context.channel
  } else if (context.phase === 'lookup' || context.phase === 'redemption') {
    if (context.phase === 'redemption' && !['reset', 'magic-link', 'invite', 'mfa'].includes(context.selector.kind))
      throw new Error('Unsupported auth redemption selector')
    settings['nzila.auth_selector'] = context.selector.kind
    if (context.selector.kind === 'email') {
      const email = context.selector.email.trim().toLowerCase()
      if (!email || email.length > 255) throw new Error('Invalid auth email selector')
      settings['nzila.auth_email'] = email
    } else {
      if (!/^[a-f0-9]{64}$/.test(context.selector.tokenHash))
        throw new Error('Invalid auth token hash selector')
      settings['nzila.auth_token_hash'] = context.selector.tokenHash
    }
  } else if (context.phase === 'identity' || context.phase === 'tenant-admin') {
    if (!context.userId.trim()) throw new Error('Validated auth user id is required')
    settings['nzila.auth_user_id'] = context.userId
    if (context.phase === 'tenant-admin') {
      if (!validUuid(context.organizationId)) throw new Error('Tenant auth authority requires organization id')
      settings['nzila.auth_org_id'] = context.organizationId
    }
  } else if (context.phase === 'issuance') {
    const email = context.email.trim().toLowerCase()
    if (!email || email.length > 255) throw new Error('Invalid auth email selector')
    if (!['signup', 'reset-issue', 'magic-issue', 'policy-discovery'].includes(context.operation))
      throw new Error('Unsupported auth issuance operation')
    if (context.organizationId && !validUuid(context.organizationId)) throw new Error('Invalid auth organization id')
    settings['nzila.auth_email'] = email
    settings['nzila.auth_ip'] = context.ipAddress ?? ''
    settings['nzila.auth_org_id'] = context.organizationId ?? ''
    settings['nzila.auth_operation'] = context.operation
  } else if (context.phase === 'provider') {
    if (!context.provider.trim() || !context.providerSubject.trim() || context.providerSubject.length > 512)
      throw new Error('Validated provider namespace and subject required')
    settings['nzila.auth_provider'] = context.provider.trim().toLowerCase()
    settings['nzila.auth_provider_subject'] = context.providerSubject
  } else if (context.phase === 'mfa-admin') {
    if (!context.actorUserId.trim() || !context.targetUserId.trim() || !context.reason.trim())
      throw new Error('Admin MFA mutation requires actor, target and reason')
    settings['nzila.auth_actor_id'] = context.actorUserId
    settings['nzila.auth_user_id'] = context.targetUserId
    settings['nzila.auth_reason'] = context.reason
  } else if (context.phase === 'cleanup') {
    if (!context.actorUserId.trim() || !context.reason.trim()) throw new Error('Auth cleanup requires actor and reason')
    settings['nzila.auth_actor_id'] = context.actorUserId
    settings['nzila.auth_reason'] = context.reason
  } else {
    if (!context.actorUserId.trim() || !context.targetUserId.trim() || !context.reason.trim())
      throw new Error('System auth mutation requires actor, target and reason')
    if (!(context.phase === 'system' ? ['revoke-sessions', 'membership-state'] : ['suspend', 'reactivate', 'deprovision']).includes(context.operation))
      throw new Error('Unsupported system auth mutation')
    if (context.phase === 'system' && context.operation === 'membership-state' &&
        !validUuid(context.organizationId ?? ''))
      throw new Error('Membership auth mutation requires organization id')
    settings['nzila.auth_user_id'] = context.targetUserId
    settings['nzila.auth_actor_id'] = context.actorUserId
    settings['nzila.auth_org_id'] = context.phase === 'system' ? context.organizationId ?? '' : ''
    settings['nzila.auth_operation'] = context.operation
    settings['nzila.auth_reason'] = context.reason
  }
  return settings
}

function validUuid(value: string): boolean {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)
}

export const AUTH_TENANT_ASSIGNABLE_ROLES = ['member', 'steward', 'chief_steward', 'admin'] as const

export function authExecutionRole(context: AuthExecutionContext): string {
  if (context.phase === 'audit') return AUTH_EXECUTION_ROLES.audit
  if (context.phase === 'tenant-admin') return AUTH_EXECUTION_ROLES.tenantAdmin
  if (context.phase === 'mfa-admin') return AUTH_EXECUTION_ROLES.mfaAdmin
  if (context.phase === 'system') return AUTH_EXECUTION_ROLES.system
  return AUTH_EXECUTION_ROLES[context.phase]
}

/** External app rewiring is tracked separately from the implemented shared paths. */
export const AUTH_BOUNDARY_GAPS: readonly string[] = []

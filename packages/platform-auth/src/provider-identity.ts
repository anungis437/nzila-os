import { and, eq, sql } from 'drizzle-orm'
import { authDb, withAuthContext } from './auth-db'
import { authOrganizationUsers, authUsers } from '@nzila/db/schema'
import { getOrgAuthPolicy } from './policy/service'
import { createSession, setSessionCookie } from './password/session'
import type { ExternalIdentityBinding } from './authorization-context'

/**
 * Server-internal resolver, called only after provider credential verification.
 * The provider namespace and immutable tenant:object subject are never an email.
 */
export async function resolveExternalAuthIdentity(
  provider: string, providerSubject: string,
): Promise<ExternalIdentityBinding | null> {
  return withAuthContext({ phase: 'provider', provider, providerSubject }, async () => {
    const [resolved] = await authDb.execute(sql`SELECT user_management.auth_provider_binding() AS binding`)
    const binding = resolved?.binding as {
      id: string; provider: string; providerSubject: string; platformUserId: string; state: 'active'; verifiedAt: string
    } | null
    if (!binding) return null
    const [principal] = await authDb.execute(sql`SELECT user_id FROM user_management.users
      WHERE user_id=${binding.platformUserId} AND is_active AND lifecycle_state='active'`)
    if (!principal) return null
    return { ...binding, verifiedAt: new Date(binding.verifiedAt),
      principal: { id: binding.platformUserId, state: 'active' } }
  })
}

/**
 * Promote a cryptographically verified provider subject into the ordinary
 * opaque platform session. Email is never a binding key: a live pre-provisioned
 * provider binding and active organization membership are both mandatory.
 */
export async function completeExternalProviderAuth(input: {
  provider: string
  providerSubject: string
  organizationId: string
  mfaSatisfied: boolean
  ipAddress?: string | null
  userAgent?: string | null
}): Promise<{ userId: string }> {
  return withAuthContext({ phase: 'provider', provider: input.provider, providerSubject: input.providerSubject }, async () => {
    const [resolved] = await authDb.execute(sql`SELECT user_management.auth_provider_binding() AS binding`)
    const binding = resolved?.binding as { platformUserId: string; state: 'active'; verifiedAt: string } | null
    if (!binding?.platformUserId || !binding.verifiedAt) throw new Error('No verified platform identity binding exists')
    const [principal] = await authDb.select({
      userId: authUsers.userId,
      active: authUsers.isActive,
      lifecycle: authUsers.lifecycleState,
      localMfa: authUsers.twoFactorEnabled,
    }).from(authUsers).where(eq(authUsers.userId, binding.platformUserId)).limit(1)
    if (!principal?.active || principal.lifecycle !== 'active') throw new Error('User account is not active')
    const [membership] = await authDb.select({ role: authOrganizationUsers.role }).from(authOrganizationUsers).where(and(
      eq(authOrganizationUsers.userId, principal.userId),
      eq(authOrganizationUsers.organizationId, input.organizationId),
      eq(authOrganizationUsers.isActive, true),
    )).limit(1)
    if (!membership) throw new Error('Active organization membership is required')
    const policy = await getOrgAuthPolicy(input.organizationId)
    if (!policy.allowSso) throw new Error('Organization policy does not allow SSO')
    if ((principal.localMfa || policy.mfaRequiredForRoles.includes(membership.role)) && !input.mfaSatisfied) {
      throw new Error('The identity provider did not satisfy the required multi-factor policy')
    }
    const { token, session } = await createSession({
      userId: principal.userId,
      organizationId: input.organizationId,
      ipAddress: input.ipAddress ?? undefined,
      userAgent: input.userAgent ?? undefined,
    })
    await setSessionCookie(token, session.expiresAt)
    return { userId: principal.userId }
  })
}

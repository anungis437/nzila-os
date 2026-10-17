import { and, eq } from 'drizzle-orm'
import { authUsers, authOrganizationUsers } from '@nzila/db/schema'
import { authDb } from './auth-db'
import { issueMfaChallenge } from './mfa/service'
import { getOrgAuthPolicy } from './policy/service'
import { createSession, setSessionCookie } from './password/session'

/** A validated inbox bearer is a first factor, never an MFA bypass. */
export async function completeAuthFirstFactor(input: Parameters<typeof createSession>[0]): Promise<{
  requiresMfa?: true; challengeToken?: string
}> {
  const [user] = await authDb.select({
    active: authUsers.isActive, lifecycle: authUsers.lifecycleState, mfa: authUsers.twoFactorEnabled,
  }).from(authUsers).where(eq(authUsers.userId, input.userId)).limit(1)
  if (!user?.active || user.lifecycle !== 'active') throw new Error('User account is not active')
  const [membership] = await authDb.select({ organizationId: authOrganizationUsers.organizationId, role: authOrganizationUsers.role })
    .from(authOrganizationUsers).where(and(eq(authOrganizationUsers.userId, input.userId), eq(authOrganizationUsers.isActive, true),
      ...(input.organizationId ? [eq(authOrganizationUsers.organizationId, input.organizationId)] : []))).limit(1)
  const policy = await getOrgAuthPolicy(membership?.organizationId)
  if (membership && policy.mfaRequiredForRoles.includes(membership.role) && !user.mfa)
    throw new Error('Two-factor authentication is required for this account. Please contact your administrator to enroll.')
  if (user.mfa) {
    const challenge = await issueMfaChallenge(input)
    return { requiresMfa: true, challengeToken: challenge.challengeToken }
  }
  const { token, session } = await createSession(input)
  await setSessionCookie(token, session.expiresAt)
  return {}
}

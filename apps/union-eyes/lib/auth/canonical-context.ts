import { and, eq } from 'drizzle-orm'
import { authUsers } from '@nzila/db/schema'
import { authDb, withAuthContext } from '@nzila/platform-auth/auth-execution'
import { getAuthUser } from '@nzila/platform-auth/password'
import { AuthOrgBindingError, type AuthOrgBindingOptions } from '@nzila/platform-auth/org-binding'
import { canonicalMembershipRole } from './canonical-membership-role'
import { withCanonicalOrganizationBinding } from './canonical-organization-selection'

async function readCanonicalProfile(userId: string) {
  return withAuthContext({ phase: 'identity', userId }, async () => {
    const [user] = await authDb
      .select({
        email: authUsers.email,
        firstName: authUsers.firstName,
        lastName: authUsers.lastName,
        isSystemAdmin: authUsers.isSystemAdmin,
      })
      .from(authUsers)
      .where(
        and(
          eq(authUsers.userId, userId),
          eq(authUsers.isActive, true),
          eq(authUsers.lifecycleState, 'active'),
        ),
      )
      .limit(1)
    if (!user) throw new AuthOrgBindingError('UNAUTHENTICATED')
    return { ...user, isSystemAdmin: user.isSystemAdmin === true }
  })
}

export async function getCanonicalPasswordActor() {
  const actor = await getAuthUser()
  if (!actor) return null
  return {
    ...(await readCanonicalProfile(actor.id)),
    userId: actor.id,
    organizationId: actor.organizationId,
  }
}

export async function getCanonicalOrganizationContext(options: AuthOrgBindingOptions = {}) {
  return withCanonicalOrganizationBinding(options, async (binding) => {
    const profile = await readCanonicalProfile(binding.userId)
    const role = canonicalMembershipRole(binding.role, profile.isSystemAdmin)
    return {
      ...profile,
      userId: binding.userId,
      organizationId: binding.organizationId,
      role,
    }
  })
}

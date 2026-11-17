import { AsyncLocalStorage } from 'node:async_hooks'
import { AuthOrgBindingError, type AuthenticatedOrgBinding, type AuthOrgBindingOptions } from '@nzila/platform-auth/org-binding'
import { getActiveSystemDb } from '@/db/system-context-storage'
import type { UserRole } from './roles'

export interface CanonicalRequestProfile {
  userId: string
  organizationId: string
  role: UserRole
  email: string
  firstName: string | null
  lastName: string | null
  isSystemAdmin: boolean
}

const requests = new AsyncLocalStorage<{
  binding: AuthenticatedOrgBinding
  profile: CanonicalRequestProfile
  active: boolean
}>()

/** Server-only, callback-scoped authority. Never serialize this scope or its bearer. */
export function currentCanonicalRequest(options: AuthOrgBindingOptions = {}) {
  const scope = requests.getStore()
  if (!scope) return null
  if (getActiveSystemDb()) throw new AuthOrgBindingError('ROLE_REQUIRED')
  const { binding } = scope
  if (!scope.active || !Number.isFinite(binding.expiresAt.getTime()) || binding.expiresAt.getTime() <= Date.now())
    throw new AuthOrgBindingError('SESSION_AUTHORITY_REQUIRED')
  if (options.expectedActorUserId && options.expectedActorUserId !== binding.userId)
    throw new AuthOrgBindingError('ACTOR_MISMATCH')
  if (options.organizationId && options.organizationId.toLowerCase() !== binding.organizationId.toLowerCase())
    throw new AuthOrgBindingError('MEMBERSHIP_REQUIRED')
  if (options.requiredRoles && !options.requiredRoles.includes(binding.role))
    throw new AuthOrgBindingError('ROLE_REQUIRED')
  return scope
}

/** Only the canonical binder may establish this scope after its live checks. */
export async function withCanonicalRequestScope<T>(
  binding: AuthenticatedOrgBinding,
  profile: CanonicalRequestProfile,
  operation: () => Promise<T>,
): Promise<T> {
  if (binding.userId !== profile.userId || binding.organizationId !== profile.organizationId)
    throw new AuthOrgBindingError('ACTOR_MISMATCH')
  // Refuse an attempt to replace an established actor or organization.
  currentCanonicalRequest({ expectedActorUserId: binding.userId, organizationId: binding.organizationId })
  const scope = { binding, profile, active: true }
  try {
    return await requests.run(scope, operation)
  } finally {
    // Detached work must not inherit usable application authority after return.
    scope.active = false
  }
}

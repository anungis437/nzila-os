import { AuthOrgBindingError } from '@nzila/platform-auth/org-binding'
import { currentStateContextEnabled } from './auth/canonical-bootstrap'
import { getCanonicalOrganizationContext, withCanonicalApiContext } from './auth/canonical-context'
import { currentCanonicalRequest } from './auth/canonical-request-scope'
import type { UserRole } from './auth/roles'
import { isPrincipalId, isUuid } from './authority/store/executor'

export type OrgActionContext = Readonly<{
  userId: string
  organizationId: string
  role: UserRole
}>
const active = new WeakSet<object>()

export function assertOrgActionContext(context: OrgActionContext): void {
  if (!context || !active.has(context)) throw new AuthOrgBindingError('SESSION_AUTHORITY_REQUIRED')
  const current = currentCanonicalRequest({
    expectedActorUserId: context.userId,
    organizationId: context.organizationId,
  })
  if (!current) throw new AuthOrgBindingError('SESSION_AUTHORITY_REQUIRED')
}

/** A server action owns one real canonical bridge through its last database
 * commit. The callback receives no bearer and cannot change actor or tenant.
 * Legacy identity GUCs and provider role metadata never establish this scope. */
export async function resolveOrgContext<T>(
  request: { organizationId?: string; expectedActorUserId?: string },
  operation: (context: OrgActionContext) => Promise<T>,
): Promise<T> {
  if (!currentStateContextEnabled()) throw new AuthOrgBindingError('SESSION_AUTHORITY_REQUIRED')
  if (request.organizationId !== undefined && !isUuid(request.organizationId))
    throw new AuthOrgBindingError('INVALID_ORGANIZATION')
  if (request.expectedActorUserId !== undefined && !isPrincipalId(request.expectedActorUserId))
    throw new AuthOrgBindingError('ACTOR_MISMATCH')
  return withCanonicalApiContext(async () => {
    const profile = await getCanonicalOrganizationContext(request)
    const context: OrgActionContext = Object.freeze({
      userId: profile.userId,
      organizationId: profile.organizationId,
      role: profile.role,
    })
    active.add(context)
    try {
      return await operation(context)
    } finally {
      active.delete(context)
    }
  })
}

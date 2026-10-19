/**
 * Organization Middleware
 *
 * Middleware to enforce organization context in API routes.
 * Validates organization access and injects organization ID into request context.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getOrganizationIdForUser,
  getUserRoleInOrganization,
  userHasOrganizationAccess,
  validateOrganizationExists,
} from '@/lib/organization-utils'
import { requireUser, requireUserForOrganization } from '@/lib/api-auth-guard'
import { cookies } from 'next/headers'
import { createLogger } from '@nzila/os-core'
import { currentStateContextEnabled } from '@/lib/auth/canonical-bootstrap'
import { getCanonicalOrganizationContext } from '@/lib/auth/canonical-context'

const logger = createLogger('organization-middleware')

export interface OrganizationContext {
  organizationId: string
  userId: string
  memberId: string
}

/**
 * Middleware to extract and validate organization context
 *
 * Usage in API routes:
 * ```typescript
 * import { withOrganizationAuth } from "@/lib/organization-middleware";
 *
 * export const GET = withOrganizationAuth(async (request, context) => {
 *   const { organizationId, userId } = context;
 *   // Your organization-aware logic here
 * });
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withOrganizationAuth<T = any>(
  handler: (
    request: NextRequest,
    context: OrganizationContext,
    params?: T,
  ) => Promise<NextResponse> | NextResponse,
) {
  return async (
    request: NextRequest,
    routeContext?: { params: Promise<T> | T },
  ): Promise<NextResponse> => {
    try {
      const baseUser = await requireUser()

      if (currentStateContextEnabled()) {
        const canonical = await getCanonicalOrganizationContext({
          expectedActorUserId: baseUser.userId,
        })
        const context: OrganizationContext = {
          organizationId: canonical.organizationId,
          userId: canonical.userId,
          memberId: `auth-org:${canonical.organizationId}`,
        }
        const params = routeContext?.params ? await Promise.resolve(routeContext.params) : undefined
        const { withRLSContext: withCanonicalRLSContext } =
          await import('@/lib/db/with-rls-context')
        // Plain `db` calls in the handler must run on the canonical actor/org transaction.
        return await withCanonicalRLSContext({ organizationId: canonical.organizationId }, () =>
          Promise.resolve(handler(request, context, params)),
        )
      }

      const { withRLSContext } = await import('@/lib/db/with-rls-context')

      // Resolve org under the authenticated identity's bootstrap context so the
      // user-scoped membership policy (user_id = app.current_user_id) is satisfied
      // before an active org is known. 'system' sets app.current_user_id and
      // clears org — runtime role, no privilege escalation, no client-trusted org.
      const organizationId = await withRLSContext({ organizationId: 'system' }, async () =>
        getOrganizationIdForUser(baseUser.userId),
      )

      // Run membership verification and the handler under the resolved org's
      // transaction-local RLS context so org-scoped reads are visible to the
      // RLS-constrained runtime role.
      return await withRLSContext({ organizationId }, async () => {
        const user = await requireUserForOrganization(organizationId, baseUser.userId)

        const context: OrganizationContext = {
          organizationId,
          userId: user.userId,
          memberId: user.memberId || '',
        }

        const params = routeContext?.params ? await Promise.resolve(routeContext.params) : undefined

        return handler(request, context, params)
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      logger.error('withOrganizationAuth failed', {
        error: message,
        stack: error instanceof Error ? error.stack : undefined,
      })
      if (message === 'Unauthorized') {
        return NextResponse.json(
          { error: 'Unauthorized - Authentication required' },
          { status: 401 },
        )
      }
      if (message === 'Forbidden') {
        return NextResponse.json(
          { error: 'Forbidden - User is not a member of this organization' },
          { status: 403 },
        )
      }
      if (error instanceof Error && (error as { code?: string }).code === 'ENTITLEMENT_REQUIRED') {
        return NextResponse.json(
          { error: 'Module access denied', code: 'ENTITLEMENT_REQUIRED' },
          { status: 403 },
        )
      }
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
}

/**
 * Get organization ID from cookies (for server components).
 * Reads selected_org_id / selected_organization_id cookie.
 * Returns null if none set.
 */
export async function getOrganizationId(): Promise<string | null> {
  const cookieStore = await cookies()
  return (
    cookieStore.get('selected_org_id')?.value ??
    cookieStore.get('selected_organization_id')?.value ??
    null
  )
}

/**
 * Validate organization access for a specific organization ID
 *
 * Use this when the organization ID comes from the request (e.g., URL parameter)
 * to ensure the user has access to that specific organization.
 */
export async function validateOrganizationAccess(
  userId: string,
  requestedOrganizationId: string,
): Promise<boolean> {
  try {
    if (!userId || !requestedOrganizationId) {
      return false
    }

    // Existence is required and is never sufficient. A role held in some other
    // organization, including local admin, does not authorize this one.
    const exists = await validateOrganizationExists(requestedOrganizationId)
    if (!exists) {
      return false
    }

    if (!(await userHasOrganizationAccess(userId, requestedOrganizationId))) {
      return false
    }

    const role = await getUserRoleInOrganization(userId, requestedOrganizationId)
    return role !== null
  } catch (_error) {
    return false
  }
}

/**
 * Accept a client-supplied organization id only when it exists and the user
 * is an active member. Forged headers and cookies that name another tenant,
 * or that name nothing, are ignored.
 */
async function authorizedOrganizationSignal(
  organizationId: string | null | undefined,
  userId: string,
): Promise<string | null> {
  if (!userId || !organizationId) {
    return null
  }

  const exists = await validateOrganizationExists(organizationId)
  if (!exists) {
    return null
  }

  if (!(await userHasOrganizationAccess(userId, organizationId))) {
    logger.warn('Rejected organization selection without membership', {
      userId,
      organizationId,
    })
    return null
  }

  return organizationId
}

/**
 * Extract an organization id the authenticated user is allowed to use.
 *
 * Client signals are considered in this order, and only when the organization
 * exists and the user is an active member:
 * 1. X-Org-ID header
 * 2. X-Organization-ID header
 * 3. selected_org_id cookie
 * 4. selected_organization_id cookie
 * 5. X-Tenant-ID header (legacy)
 * 6. selected_tenant_id cookie (legacy)
 *
 * If none of those signals are authorized, the user's verified membership
 * from getOrganizationIdForUser is used.
 */
export async function getOrganizationIdFromRequest(
  request: NextRequest,
  userId: string,
): Promise<string> {
  const cookieStore = await cookies()

  // Higher-precedence authorized membership wins. A later signal that names a
  // different organization the user also belongs to is ignored, not merged.
  // Unauthorized signals are skipped rather than selected.
  const signals = [
    request.headers.get('X-Org-ID'),
    request.headers.get('X-Organization-ID'),
    cookieStore.get('selected_org_id')?.value,
    cookieStore.get('selected_organization_id')?.value,
    request.headers.get('X-Tenant-ID'),
    cookieStore.get('selected_tenant_id')?.value,
  ]

  let selected: string | null = null
  for (const signal of signals) {
    const authorized = await authorizedOrganizationSignal(signal, userId)
    if (!authorized) continue
    if (!selected) {
      selected = authorized
      continue
    }
    if (selected !== authorized) {
      logger.warn('Conflicting authorized organization signals; keeping higher-precedence membership', {
        userId,
        selected,
        ignored: authorized,
      })
    }
  }

  if (selected) return selected

  // No client signal belonged to this user. Resolve from verified membership.
  return getOrganizationIdForUser(userId)
}

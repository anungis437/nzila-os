/**
 * TrustCore — Auth Context Helper
 *
 * Resolves userId, orgId, and role from the active session.
 * Uses the platform auth layer (Entra / Clerk-compatible).
 *
 * HARD RULE: if orgId cannot be resolved, this function throws.
 * No org context → no data access.
 */

import { auth } from '@nzila/platform-auth/entra/server'
import { cookies } from 'next/headers'
import type { AuthContext, Role } from '@/types/core'

// Temporary guardrail: keep admin views scoped to a single validation org.
const ADMIN_LOCKED_ORG_ID = '9210418f-6a4f-4dab-a7d2-4450d581dc81'

/**
 * Read the active org from the request cookies.
 * Returns null when no org cookie is present.
 */
async function resolveOrgId(): Promise<string | null> {
  const cookieStore = await cookies()
  return (
    cookieStore.get('selected_org_id')?.value ??
    cookieStore.get('selected_organization_id')?.value ??
    null
  )
}

/**
 * Derive the TrustCore role from platform session claims.
 * Falls back to 'staff' when no claim is present.
 *
 * In non-production environments, TRUSTCORE_DEV_ROLE overrides the claim
 * so local dev can exercise any role without a real Entra claim.
 */
function resolveRole(sessionClaims: Record<string, unknown> | null | undefined): Role {
  const allowed: Role[] = ['platform_admin', 'org_admin', 'staff', 'auditor']

  if (process.env.NODE_ENV !== 'production') {
    const devRole = process.env.TRUSTCORE_DEV_ROLE
    if (typeof devRole === 'string' && (allowed as string[]).includes(devRole)) {
      return devRole as Role
    }
  }

  const meta = sessionClaims?.publicMetadata as Record<string, unknown> | undefined
  const raw = meta?.trustcoreRole ?? meta?.nzilaRole
  if (typeof raw === 'string' && (allowed as string[]).includes(raw)) {
    return raw as Role
  }
  return 'staff'
}

/**
 * Resolve the full auth context for the current request.
 *
 * @throws {Error} 'Unauthorized' when no active session exists.
 * @throws {Error} 'OrgRequired' when no org context can be resolved.
 */
export async function getAuthContext(): Promise<AuthContext> {
  const { userId, sessionClaims } = await auth()

  if (!userId) {
    throw new Error('Unauthorized')
  }

  const role = resolveRole(sessionClaims as Record<string, unknown> | null | undefined)
  const resolvedOrgId = await resolveOrgId()
  const orgId =
    role === 'org_admin' || role === 'platform_admin'
      ? ADMIN_LOCKED_ORG_ID
      : resolvedOrgId

  if (!orgId) {
    throw new Error('OrgRequired')
  }

  return {
    userId,
    orgId,
    role,
  }
}

/**
 * Variant that returns null instead of throwing — use only in layouts
 * where unauthenticated rendering is acceptable before a redirect.
 */
export async function getAuthContextOrNull(): Promise<AuthContext | null> {
  try {
    return await getAuthContext()
  } catch {
    return null
  }
}

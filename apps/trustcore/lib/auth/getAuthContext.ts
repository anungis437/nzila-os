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
 */
function resolveRole(sessionClaims: Record<string, unknown> | null | undefined): Role {
  const meta = sessionClaims?.publicMetadata as Record<string, unknown> | undefined
  const raw = meta?.trustcoreRole ?? meta?.nzilaRole
  const allowed: Role[] = [
    'platform_admin',
    'org_admin',
    'compliance_officer',
    'security_officer',
    'privacy_officer',
    'legal_reviewer',
    'staff',
    'external_auditor',
    'auditor',
    'read_only',
  ]
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

  const orgId = await resolveOrgId()

  if (!orgId) {
    throw new Error('OrgRequired')
  }

  const role = resolveRole(sessionClaims as Record<string, unknown> | null | undefined)

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

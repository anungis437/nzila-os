/**
 * Org context resolution — Cora Insights (read-only).
 *
 * Resolves a fully typed `AgriOrgContext` from auth session.
 * Cora is a read-only intelligence platform — the resolved context
 * enforces read-only permissions only.
 *
 * @module resolve-org
 */
import { auth, currentUser } from '@nzila/platform-auth/entra/server'
import type { AgriOrgContext } from '@nzila/agri-core'
import type { AgriOrgRole } from '@nzila/agri-core'

import { isSuperAdmin } from '@nzila/os-core/config/super-admins'

/**
 * Resolve org context from auth session (read-only).
 *
 * @throws Error('Unauthorized') if unauthenticated
 * @throws Error('No active organization') if no org selected
 */
export async function resolveOrgContext(): Promise<AgriOrgContext> {
  const { userId, orgId, orgRole, sessionClaims } = await auth()

  if (!userId) {
    throw new Error('Unauthorized')
  }

  if (!orgId) {
    throw new Error('No active organization — select an org before accessing Cora Insights.')
  }

  let role = mapAuthRoleToAgriRole(orgRole, sessionClaims)

  // Super-admin email override
  if (role !== 'admin') {
    const user = await currentUser()
    const email = user?.primaryEmailAddress?.emailAddress
                ?? user?.emailAddresses?.[0]?.emailAddress
    if (isSuperAdmin(email)) {
      role = 'admin' as AgriOrgRole
    }
  }

  return {
    orgId,
    actorId: userId,
    role,
    // Cora is read-only — no write permissions
    permissions: ['agri:read', 'agri:dashboard:view', 'agri:intelligence:view', 'agri:evidence:view'],
    requestId: crypto.randomUUID(),
  }
}

function mapAuthRoleToAgriRole(
  orgRole: string | undefined | null,
  sessionClaims: Record<string, unknown> | undefined | null,
): AgriOrgRole {
  const metaRole = (
    sessionClaims as { publicMetadata?: { agriRole?: string } } | undefined
  )?.publicMetadata?.agriRole

  if (
    metaRole &&
    ['admin', 'cooperative_manager', 'field_agent', 'warehouse_manager', 'buyer', 'viewer'].includes(
      metaRole,
    )
  ) {
    return metaRole as AgriOrgRole
  }

  switch (orgRole) {
    case 'org:admin':
      return 'admin'
    case 'org:member':
      return 'viewer'
    default:
      return 'viewer'
  }
}

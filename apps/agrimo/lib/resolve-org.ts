/**
 * Org context resolution — Agrimo.
 *
 * Resolves a fully typed `AgriOrgContext` from auth session.
 * Every `'use server'` action MUST call `resolveOrgContext()` at the top
 * and use the returned context for:
 *   - org-scoped DB queries (WHERE org_id = ctx.orgId)
 *   - org-scoped DB inserts (org_id = ctx.orgId)
 *   - audit trail attribution
 *   - evidence generation
 *
 * This enforces the ORG_REQUIRED invariant at the server action boundary —
 * no query can accidentally omit the org filter.
 *
 * @module resolve-org
 */
import { auth, currentUser } from '@nzila/platform-auth/entra/server'
import type { AgriOrgContext } from '@nzila/agri-core'
import type { AgriOrgRole } from '@nzila/agri-core'

import { isSuperAdmin } from '@nzila/os-core/config/super-admins'

/**
 * Resolve org context from auth session.
 *
 * `auth()` returns `orgId` when the user has an active
 * organization selected. We map this to the NzilaOS `orgId`.
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
    throw new Error('No active organization — select an org before accessing Agrimo.')
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
    permissions: derivePermissions(role),
    requestId: crypto.randomUUID(),
  }
}

/**
 * Map auth organization role to AgriOrgRole.
 */
function mapAuthRoleToAgriRole(
  orgRole: string | undefined | null,
  sessionClaims: Record<string, unknown> | undefined | null,
): AgriOrgRole {
  const metaRole = (
    sessionClaims as { publicMetadata?: { agriRole?: string } } | undefined
  )?.publicMetadata?.agriRole

  if (
    metaRole &&
    ['admin', 'manager', 'operator', 'viewer'].includes(
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

/**
 * Derive permission keys from AgriOrgRole.
 */
function derivePermissions(role: AgriOrgRole): readonly string[] {
  const base = ['agri:read', 'agri:dashboard:view']

  switch (role) {
    case 'admin':
      return [
        ...base,
        'agri:producer:create',
        'agri:producer:manage',
        'agri:harvest:create',
        'agri:lot:create',
        'agri:lot:transition',
        'agri:quality:inspect',
        'agri:warehouse:manage',
        'agri:batch:create',
        'agri:shipment:create',
        'agri:shipment:milestone',
        'agri:payment:create',
        'agri:payment:disburse',
        'agri:certification:upload',
        'agri:evidence:view',
        'agri:settings:manage',
      ]
    case 'manager':
      return [
        ...base,
        'agri:producer:create',
        'agri:producer:manage',
        'agri:harvest:create',
        'agri:lot:create',
        'agri:lot:transition',
        'agri:quality:inspect',
        'agri:warehouse:manage',
        'agri:batch:create',
        'agri:shipment:create',
        'agri:payment:create',
        'agri:payment:disburse',
        'agri:certification:upload',
      ]
    case 'operator':
      return [
        ...base,
        'agri:producer:create',
        'agri:harvest:create',
        'agri:lot:create',
        'agri:lot:transition',
        'agri:quality:inspect',
        'agri:warehouse:manage',
        'agri:batch:create',
        'agri:shipment:create',
        'agri:shipment:milestone',
      ]
    case 'viewer':
    default:
      return base
  }
}

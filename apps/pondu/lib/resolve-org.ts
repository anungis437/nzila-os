/**
 * Org context resolution — Pondu Ops.
 *
 * Resolves a fully typed `AgriOrgContext` from Clerk auth state.
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
import { auth } from '@clerk/nextjs/server'
import type { AgriOrgContext } from '@nzila/agri-core'
import type { AgriOrgRole } from '@nzila/agri-core'

/**
 * Resolve org context from Clerk auth.
 *
 * Clerk's `auth()` returns `orgId` when the user has an active
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
    throw new Error('No active organization — select an org before accessing Pondu Ops.')
  }

  const role = mapClerkRoleToAgriRole(orgRole, sessionClaims)

  return {
    orgId,
    actorId: userId,
    role,
    permissions: derivePermissions(role),
    requestId: crypto.randomUUID(),
  }
}

/**
 * Map Clerk organization role to AgriOrgRole.
 */
function mapClerkRoleToAgriRole(
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

/**
 * Org context resolution — NACP Exams.
 *
 * Resolves a fully typed `NacpOrgContext` from auth session.
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
import { redirect } from 'next/navigation'
import { NacpRole } from '@nzila/nacp-core/enums'
import type { NacpOrgContext } from '@nzila/nacp-core/types'

import { isSuperAdmin } from '@nzila/os-core/config/super-admins'

/**
 * Resolve org context from auth session.
 *
 * `auth()` returns `orgId` when the user has an active
 * organization selected. We map this to the NzilaOS `orgId`.
 *
 * @throws Redirects to /sign-in if unauthenticated
 * @throws Redirects to /select-org if no active org
 */
export async function resolveOrgContext(): Promise<NacpOrgContext> {
  const { userId, orgId, orgRole, sessionClaims } = await auth()

  if (!userId) {
    redirect('/sign-in')
  }

  if (!orgId) {
    redirect('/select-org')
  }

  // Map auth orgRole to NacpRole
  let role = mapAuthRoleToNacpRole(orgRole, sessionClaims)

  // Super-admin email override
  if (role !== NacpRole.ADMIN) {
    const user = await currentUser()
    const email = user?.primaryEmailAddress?.emailAddress
                ?? user?.emailAddresses?.[0]?.emailAddress
    if (isSuperAdmin(email)) {
      role = NacpRole.ADMIN
    }
  }

  return {
    orgId: orgId,
    actorId: userId,
    role,
    permissions: derivePermissions(role),
    requestId: crypto.randomUUID(),
  }
}

/**
 * Map auth organization role to NacpRole.
 * Falls back to VIEWER for unknown roles.
 */
function mapAuthRoleToNacpRole(
  orgRole: string | undefined | null,
  sessionClaims: Record<string, unknown> | undefined | null,
): NacpRole {
  // Check publicMetadata first (explicit NzilaOS role override)
  const metaRole = (
    sessionClaims as { publicMetadata?: { nacpRole?: string } } | undefined
  )?.publicMetadata?.nacpRole

  if (metaRole && Object.values(NacpRole).includes(metaRole as NacpRole)) {
    return metaRole as NacpRole
  }

  // Map Clerk org roles
  switch (orgRole) {
    case 'org:admin':
      return NacpRole.ADMIN
    case 'org:member':
      return NacpRole.INVIGILATOR
    default:
      return NacpRole.VIEWER
  }
}

/**
 * Derive permission keys from NacpRole.
 * Permissions are additive: higher roles include all lower permissions.
 */
function derivePermissions(role: NacpRole): readonly string[] {
  const base = ['nacp:read', 'nacp:session:list']

  switch (role) {
    case NacpRole.ADMIN:
      return [
        ...base,
        'nacp:session:create',
        'nacp:session:update',
        'nacp:session:seal',
        'nacp:session:export',
        'nacp:session:close',
        'nacp:candidate:manage',
        'nacp:center:manage',
        'nacp:report:generate',
        'nacp:settings:manage',
      ]
    case NacpRole.EXAMINER:
      return [
        ...base,
        'nacp:session:create',
        'nacp:session:update',
        'nacp:session:seal',
        'nacp:candidate:manage',
        'nacp:report:generate',
      ]
    case NacpRole.INVIGILATOR:
      return [
        ...base,
        'nacp:session:update',
        'nacp:candidate:manage',
      ]
    case NacpRole.VIEWER:
    default:
      return base
  }
}

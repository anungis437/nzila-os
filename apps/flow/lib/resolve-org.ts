/**
 * Org context resolution — Flow.
 *
 * Resolves an `OrgContext` from Clerk auth state.
 * Every `'use server'` action MUST call `resolveOrgContext()` at the top
 * and use the returned context for org-scoped DB queries.
 *
 * @module resolve-org
 */
import { auth } from '@clerk/nextjs/server'
import type { OrgContext } from '@nzila/commerce-core/types'
import { OrgRole } from '@nzila/commerce-core/enums'
import type { OrgCommerceConfig } from '@nzila/platform-commerce-org/types'
import { getOrgCommerceConfig } from '@nzila/platform-commerce-org/service'

/**
 * Resolve org context from Clerk auth.
 *
 * @throws Error('Unauthorized') if unauthenticated
 * @throws Error('No active organization') if no org selected
 */
export async function resolveOrgContext(): Promise<OrgContext> {
  const { userId, orgId, orgRole } = await auth()

  if (!userId) {
    throw new Error('Unauthorized')
  }

  if (!orgId) {
    throw new Error('No active organization — select an org before using Flow.')
  }

  const role = mapClerkRole(orgRole)

  return {
    orgId,
    actorId: userId,
    role,
    permissions: derivePermissions(role),
    requestId: crypto.randomUUID(),
  }
}

/**
 * Composite context: OrgContext + full OrgCommerceConfig.
 *
 * Use this when a server action or API handler needs both authentication
 * AND the org's commerce configuration (settings, policies, branding, etc.).
 */
export interface OrgCommerceContext {
  ctx: OrgContext
  config: OrgCommerceConfig
}

export async function resolveOrgCommerceContext(): Promise<OrgCommerceContext> {
  const ctx = await resolveOrgContext()
  const config = await getOrgCommerceConfig(ctx.orgId)
  return { ctx, config }
}

function mapClerkRole(clerkRole: string | undefined | null): OrgRole {
  switch (clerkRole) {
    case 'org:admin':
      return OrgRole.ADMIN
    case 'org:manager':
      return OrgRole.MANAGER
    case 'org:member':
      return OrgRole.SALES
    default:
      return OrgRole.VIEWER
  }
}

function derivePermissions(role: OrgRole): string[] {
  switch (role) {
    case OrgRole.OWNER:
    case OrgRole.ADMIN:
      return ['quote:create', 'quote:read', 'quote:update', 'quote:delete', 'quote:send', 'quote:approve', 'customer:manage', 'import:legacy']
    case OrgRole.MANAGER:
      return ['quote:create', 'quote:read', 'quote:update', 'quote:send', 'quote:approve', 'customer:manage']
    case OrgRole.SALES:
      return ['quote:create', 'quote:read', 'quote:update', 'quote:send', 'customer:manage']
    default:
      return ['quote:read']
  }
}

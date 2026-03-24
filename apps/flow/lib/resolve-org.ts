/**
 * Org context resolution — Flow.
 *
 * Resolves an `OrgContext` from Clerk auth state.
 * Every `'use server'` action MUST call `resolveOrgContext()` at the top
 * and use the returned context for org-scoped DB queries.
 *
 * @module resolve-org
 */
import { auth, currentUser } from '@clerk/nextjs/server'
import type { OrgContext } from '@nzila/commerce-core/types'
import { OrgRole } from '@nzila/commerce-core/enums'
import type { OrgCommerceConfig } from '@nzila/platform-commerce-org/types'
import { getOrgCommerceConfig } from '@nzila/platform-commerce-org/service'
import { resolveInternalOrgId } from './clerk-org-resolver'

/** Emails that always receive admin role, regardless of Clerk metadata. */
const SUPER_ADMIN_EMAILS = new Set([
  'info@nzilaventures.com',
  ...(process.env.SUPER_ADMIN_EMAILS ?? '').split(',').map(s => s.trim()).filter(Boolean),
])

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

  let role = mapClerkRole(orgRole)
  const internalOrgId = await resolveInternalOrgId(orgId)

  // Super-admin email override
  if (role !== OrgRole.ADMIN) {
    const user = await currentUser()
    const email = user?.primaryEmailAddress?.emailAddress
                ?? user?.emailAddresses?.[0]?.emailAddress
    if (email && SUPER_ADMIN_EMAILS.has(email.toLowerCase())) {
      role = OrgRole.ADMIN
    }
  }

  return {
    orgId: internalOrgId,
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

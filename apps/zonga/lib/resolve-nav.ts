/**
 * Resolve navigation context for the dashboard layout (server-side).
 *
 * Lightweight version of resolveOrgContext() that returns only what
 * the sidebar needs: role + whether the user is viewing the platform org.
 * Avoids importing heavy action-only code into the layout.
 */
import { auth, currentUser } from '@clerk/nextjs/server'
import { platformDb } from '@nzila/db/platform'
import { orgs, orgMembers } from '@nzila/db'
import { eq, and } from 'drizzle-orm'
import type { ZongaRole } from '@nzila/zonga-core/types'

/** Clerk user IDs that always receive admin role. */
const PLATFORM_ADMIN_USER_IDS = new Set(
  (process.env.PLATFORM_ADMIN_USER_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
)

const SUPER_ADMIN_EMAILS = new Set([
  'info@nzilaventures.com',
  ...(process.env.SUPER_ADMIN_EMAILS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
])

/** The Nzila platform org ID — resolved once at startup. */
const PLATFORM_ORG_NAME = process.env.PLATFORM_ORG_NAME ?? 'Nzila'

export interface NavContext {
  role: ZongaRole
  isPlatformOrg: boolean
  locale: string
}

export async function resolveNavContext(locale: string): Promise<NavContext | null> {
  const { userId, orgId, orgRole, sessionClaims } = await auth()

  if (!userId || !orgId) return null

  // Resolve platform UUID
  let platformOrgId: string | null = null
  let isPlatformOrg = false
  try {
    const org = await platformDb
      .select({ id: orgs.id, legalName: orgs.legalName })
      .from(orgs)
      .where(eq(orgs.clerkOrgId, orgId))
      .limit(1)

    platformOrgId = org[0]?.id ?? null
    isPlatformOrg = org[0]?.legalName === PLATFORM_ORG_NAME
  } catch {
    // DB failure — fall through to Clerk-only resolution
  }

  // 1. PLATFORM_ADMIN_USER_IDS
  if (PLATFORM_ADMIN_USER_IDS.has(userId)) {
    return { role: 'admin', isPlatformOrg, locale }
  }

  // 2. SUPER_ADMIN_EMAILS
  const user = await currentUser()
  const email =
    user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress
  if (email && SUPER_ADMIN_EMAILS.has(email.toLowerCase())) {
    return { role: 'admin', isPlatformOrg, locale }
  }

  // 3. DB org_members
  if (platformOrgId) {
    try {
      const member = await platformDb
        .select({ role: orgMembers.role })
        .from(orgMembers)
        .where(and(eq(orgMembers.orgId, platformOrgId), eq(orgMembers.clerkUserId, userId)))
        .limit(1)

      if (member[0]?.role) {
        const mapped = mapDbRole(member[0].role)
        if (mapped) return { role: mapped, isPlatformOrg, locale }
      }
    } catch {
      // fall through
    }
  }

  // 4/5. Clerk metadata / orgRole
  const role = mapClerkRole(orgRole, sessionClaims)
  return { role, isPlatformOrg, locale }
}

function mapDbRole(dbRole: string): ZongaRole | null {
  switch (dbRole) {
    case 'org_admin': return 'admin'
    case 'org_secretary': return 'manager'
    case 'org_creator': return 'creator'
    case 'org_viewer': return 'viewer'
    default: return null
  }
}

function mapClerkRole(
  orgRole: string | undefined | null,
  sessionClaims: Record<string, unknown> | undefined | null,
): ZongaRole {
  const metaRole = (
    sessionClaims as { publicMetadata?: { zongaRole?: string } } | undefined
  )?.publicMetadata?.zongaRole

  if (metaRole && ['admin', 'creator', 'manager', 'viewer'].includes(metaRole)) {
    return metaRole as ZongaRole
  }

  switch (orgRole) {
    case 'org:admin': return 'admin'
    case 'org:manager': return 'manager'
    case 'org:creator': return 'creator'
    case 'org:viewer':
    case 'org:member':
    default: return 'viewer'
  }
}

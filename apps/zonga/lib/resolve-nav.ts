/**
 * Resolve navigation context for the dashboard layout (server-side).
 *
 * Lightweight version of resolveOrgContext() that returns only what
 * the sidebar needs: role + whether the user is viewing the platform org.
 * Avoids importing heavy action-only code into the layout.
 */
import { auth, currentUser } from '@clerk/nextjs/server'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
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
  /** True when the user has a row in zonga_creators (even without an org). */
  hasCreatorProfile: boolean
}

export async function resolveNavContext(locale: string): Promise<NavContext | null> {
  const { userId, orgId, orgRole, sessionClaims } = await auth()

  if (!userId) return null

  // When the user has no active org, check for a creator profile.
  // Creators without an org still get 'creator' role so they see Creator Studio nav.
  if (!orgId) {
    let hasCreatorProfile = false
    try {
      const { sql } = await import('drizzle-orm')
      const rows = (await platformDb.execute(
        sql`SELECT 1 FROM zonga_creators WHERE user_id = ${userId} LIMIT 1`,
      )) as unknown as { '?column?': number }[]
      hasCreatorProfile = rows.length > 0
    } catch {
      // DB failure — conservative default
    }

    // Check publicMetadata from both sessionClaims and currentUser() for zongaRole
    const claimsMeta = (sessionClaims as { publicMetadata?: { zongaRole?: string } } | undefined)
      ?.publicMetadata?.zongaRole
    let metaRole = claimsMeta
    if (!metaRole) {
      const user = await currentUser()
      metaRole = (user?.publicMetadata as { zongaRole?: string } | undefined)?.zongaRole
    }

    const isCreator = hasCreatorProfile || metaRole === 'creator'
    const role: ZongaRole = isCreator ? 'creator' : 'viewer'

    return { role, isPlatformOrg: false, locale, hasCreatorProfile: hasCreatorProfile || isCreator }
  }

  // Resolve platform UUID — raw SQL against actual `organizations` table
  let platformOrgId: string | null = null
  let isPlatformOrg = false
  try {
    const org = await platformDb.execute(
      sql`SELECT id, name FROM organizations WHERE clerk_org_id = ${orgId} LIMIT 1`,
    )

    const row = org[0] as { id: string; name: string } | undefined
    platformOrgId = row?.id ?? null
    isPlatformOrg = row?.name?.startsWith(PLATFORM_ORG_NAME) ?? false
  } catch {
    // DB failure — fall through to Clerk-only resolution
  }

  // 1. PLATFORM_ADMIN_USER_IDS
  if (PLATFORM_ADMIN_USER_IDS.has(userId)) {
    return { role: 'admin', isPlatformOrg, locale, hasCreatorProfile: true }
  }

  // 2. SUPER_ADMIN_EMAILS
  const user = await currentUser()
  const email =
    user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress
  if (email && SUPER_ADMIN_EMAILS.has(email.toLowerCase())) {
    return { role: 'admin', isPlatformOrg, locale, hasCreatorProfile: true }
  }

  // 3. DB organization_members
  if (platformOrgId) {
    try {
      const member = await platformDb.execute(
        sql`SELECT role FROM organization_members WHERE organization_id = ${platformOrgId} AND user_id = ${userId} LIMIT 1`,
      )

      const memberRow = member[0] as { role: string } | undefined
      if (memberRow?.role) {
        const mapped = mapDbRole(memberRow.role)
        if (mapped) return { role: mapped, isPlatformOrg, locale, hasCreatorProfile: true }
      }
    } catch {
      // fall through
    }
  }

  // 4/5. Clerk metadata / orgRole
  // sessionClaims may not include publicMetadata (depends on JWT template),
  // so also check currentUser() which always has it.
  let role = mapClerkRole(orgRole, sessionClaims)
  if (role === 'viewer' && user) {
    const userMeta = (user.publicMetadata as { zongaRole?: string } | undefined)?.zongaRole
    if (userMeta && ['admin', 'creator', 'manager'].includes(userMeta)) {
      role = userMeta as ZongaRole
    }
  }
  return { role, isPlatformOrg, locale, hasCreatorProfile: role !== 'viewer' }
}

function mapDbRole(dbRole: string): ZongaRole | null {
  switch (dbRole) {
    case 'admin':
    case 'org_admin': return 'admin'
    case 'manager':
    case 'org_secretary': return 'manager'
    case 'creator':
    case 'org_creator': return 'creator'
    case 'member':
    case 'viewer':
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

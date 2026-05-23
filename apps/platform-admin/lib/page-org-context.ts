/**
 * Platform Admin — Page-level org context resolver
 *
 * Server Components do not have request-level access to the org-scope guard
 * (which expects a NextRequest). This helper provides the equivalent for
 * server pages and layouts.
 *
 * Resolution order:
 *   1. `?orgId=<uuid>` in search params (explicit selection from the org picker)
 *   2. `nzila_active_org` cookie (sticky after first selection)
 *
 * If no org is selected, returns `{ status: 'no-selection', candidates }` —
 * the page should render a chooser using the candidate orgs (i.e. orgs the
 * actor is an active member of).
 *
 * If an org is selected but the actor lacks active membership, returns
 * `{ status: 'forbidden' }` — the page should render a 403.
 */
import 'server-only'
import { cookies } from 'next/headers'
import { auth } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import { orgMembers, orgs } from '@nzila/db/schema'
import { and, eq } from 'drizzle-orm'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PLATFORM_ADMIN_ROLE = 'admin'

export const ORG_COOKIE_NAME = 'nzila_active_org'

export interface PageOrgContext {
  actorId: string
  orgId: string
  orgRole: string
  orgName: string
}

export interface OrgCandidate {
  orgId: string
  orgName: string
  role: string
}

export type PageOrgResult =
  | { status: 'unauthenticated' }
  | { status: 'no-selection'; candidates: OrgCandidate[] }
  | { status: 'forbidden'; orgId: string }
  | { status: 'ok'; context: PageOrgContext }

function platformAdminIds(): Set<string> {
  return new Set(
    (process.env.PLATFORM_ADMIN_USER_IDS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )
}

async function listMemberOrgs(actorId: string): Promise<OrgCandidate[]> {
  // Platform admins (env-listed) can see every active org. We cap at 100 to
  // keep the picker bounded; if a platform admin needs more, search UI ships
  // in a later wave.
  if (platformAdminIds().has(actorId)) {
    const rows = await platformDb
      .select({ id: orgs.id, legalName: orgs.legalName })
      .from(orgs)
      .where(eq(orgs.status, 'active'))
      .limit(100)
    return rows.map((r) => ({
      orgId: r.id,
      orgName: r.legalName,
      role: PLATFORM_ADMIN_ROLE,
    }))
  }

  const rows = await platformDb
    .select({
      orgId: orgMembers.orgId,
      role: orgMembers.role,
      legalName: orgs.legalName,
    })
    .from(orgMembers)
    .innerJoin(orgs, eq(orgs.id, orgMembers.orgId))
    .where(
      and(eq(orgMembers.userId, actorId), eq(orgMembers.status, 'active')),
    )
  return rows.map((r) => ({
    orgId: r.orgId,
    orgName: r.legalName,
    role: r.role,
  }))
}

async function resolveOrgRole(
  actorId: string,
  orgId: string,
): Promise<string | null> {
  if (platformAdminIds().has(actorId)) return PLATFORM_ADMIN_ROLE
  const [row] = await platformDb
    .select({ role: orgMembers.role })
    .from(orgMembers)
    .where(
      and(
        eq(orgMembers.orgId, orgId),
        eq(orgMembers.userId, actorId),
        eq(orgMembers.status, 'active'),
      ),
    )
    .limit(1)
  return row?.role ?? null
}

export async function getPageOrgContext(
  searchParams?: { orgId?: string | string[] },
): Promise<PageOrgResult> {
  const session = await auth()
  if (!session?.userId) return { status: 'unauthenticated' }
  const actorId = session.userId

  const rawParam = Array.isArray(searchParams?.orgId)
    ? searchParams!.orgId[0]
    : searchParams?.orgId
  let selectedOrgId = rawParam && UUID_RE.test(rawParam) ? rawParam : undefined
  if (!selectedOrgId) {
    const c = await cookies()
    const cookieVal = c.get(ORG_COOKIE_NAME)?.value
    if (cookieVal && UUID_RE.test(cookieVal)) selectedOrgId = cookieVal
  }

  if (!selectedOrgId) {
    const candidates = await listMemberOrgs(actorId)
    return { status: 'no-selection', candidates }
  }

  const orgRole = await resolveOrgRole(actorId, selectedOrgId)
  if (!orgRole) return { status: 'forbidden', orgId: selectedOrgId }

  const [row] = await platformDb
    .select({ legalName: orgs.legalName })
    .from(orgs)
    .where(eq(orgs.id, selectedOrgId))
    .limit(1)

  return {
    status: 'ok',
    context: {
      actorId,
      orgId: selectedOrgId,
      orgRole,
      orgName: row?.legalName ?? selectedOrgId,
    },
  }
}

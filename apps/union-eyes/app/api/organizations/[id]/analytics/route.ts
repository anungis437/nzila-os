import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@nzila/platform-auth/entra/server'
import { db } from '@/db/db'
import { organizations } from '@/db/schema-organizations'
import { eq, sql } from 'drizzle-orm'
import { withRLSContext, withSystemContext } from '@/lib/db/with-rls-context'
import { ROLE_HIERARCHY } from '@/lib/api-auth-guard'
import { shouldSuppressClaimMetrics, shouldSuppressMemberMetrics, MIN_PUBLISHABLE_GROUP_SIZE } from '@/lib/organizations/analytics-privacy'
import {
  canAdministerOrganization,
  canReadOrganization,
  directRoleIn,
  resolveOrganizationAccess,
  UUID_PATTERN,
} from '@/lib/organizations/read-authority'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

/** A raw query answers an array on the production driver and { rows } on others; both are rows. */
const rowsOf = <T,>(result: unknown): T[] =>
  Array.isArray(result) ? (result as T[]) : ((result as { rows?: T[] } | null)?.rows ?? Array.from((result ?? []) as Iterable<T>))

export async function GET(_req: NextRequest, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: 'Invalid organization id' }, { status: 400 })

  // Analytics aggregate an organization's membership and caseload: they belong to its officers, the administrators above
  // it and the platform, and a signed-in stranger must not learn that the organization exists.
  const access = await resolveOrganizationAccess(userId)
  if (!canReadOrganization(access, id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const directRole = directRoleIn(access, id)
  const officer = (ROLE_HIERARCHY[(directRole ?? '') as keyof typeof ROLE_HIERARCHY] ?? 0) >= ROLE_HIERARCHY.officer
  if (!canAdministerOrganization(access, id) && !officer) {
    return NextResponse.json({ error: 'Forbidden: requires officer role' }, { status: 403 })
  }

  const [org] = await withSystemContext(() =>
    db.select().from(organizations).where(eq(organizations.id, id)),
  )
  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const childRows = await withSystemContext(async () =>
    rowsOf<{ cnt: number }>(await db.execute(sql`SELECT count(*)::int AS cnt FROM organizations WHERE parent_id = ${id}`)),
  )
  const childOrganizations = childRows[0]?.cnt ?? 0

  // Every figure belongs to the organization named in the path, so the queries run with that organization's identity,
  // never the caller's own. Under the caller's organization a parent administrator read zeros for a child. A caller with
  // no direct membership here (a platform or parent administrator, authorized above) reads under the system role with the
  // exact organization predicate.
  const aggregate = async (q: typeof db) => {
    const memberRows = rowsOf<{ total: number; active: number; new_this_month: number; prev: number }>(
      await q.execute(
        sql`SELECT
              count(*)::int AS total,
              count(*) FILTER (WHERE status = 'active')::int AS active,
              count(*) FILTER (WHERE created_at >= date_trunc('month', now()))::int AS new_this_month,
              count(*) FILTER (WHERE created_at < date_trunc('month', now()))::int AS prev
            FROM organization_members
            WHERE organization_id = ${id}`,
      ),
    )
    const mem = memberRows[0] ?? { total: 0, active: 0, new_this_month: 0, prev: 0 }

    const claimRows = rowsOf<{ total: number; active: number; resolved: number; this_month: number }>(
      await q.execute(
        sql`SELECT
              count(*)::int AS total,
              count(*) FILTER (WHERE status::text IN ('draft','filed','acknowledged','investigating','response_due','response_received','escalated','mediation','arbitration'))::int AS active,
              count(*) FILTER (WHERE status::text IN ('settled','closed','withdrawn','denied'))::int AS resolved,
              count(*) FILTER (WHERE created_at >= date_trunc('month', now()))::int AS this_month
            FROM grievances
            WHERE organization_id = ${id}`,
      ),
    )
    const claims = claimRows[0] ?? { total: 0, active: 0, resolved: 0, this_month: 0 }

    // Average resolution days, over resolved grievances only; null when none has resolved.
    const resRows = rowsOf<{ avg_days: number | null }>(
      await q.execute(
        sql`SELECT avg(EXTRACT(EPOCH FROM (coalesce(resolved_at, closed_at) - created_at)) / 86400)::int AS avg_days
            FROM grievances
            WHERE organization_id = ${id}
              AND (resolved_at IS NOT NULL OR closed_at IS NOT NULL)`,
      ),
    )
    const avgResolutionDays = resRows[0]?.avg_days ?? null

    const statusRows = rowsOf<{ status: string; cnt: number }>(
      await q.execute(
        sql`SELECT status::text AS status, count(*)::int AS cnt
            FROM grievances WHERE organization_id = ${id}
            GROUP BY status`,
      ),
    )
    const claimsByStatus: Record<string, number> = {}
    for (const r of statusRows) claimsByStatus[r.status] = r.cnt

    // Growth against last month is undefined when the organization had no members before this month.
    const memberGrowthRate = mem.prev > 0 ? Math.round(((mem.total - mem.prev) / mem.prev) * 1000) / 10 : null

    // A single small cell, including its complement to a published total, can identify individual members.
    // Suppress the whole metric family rather than leaving totals or rates from which the cell can be derived.
    const suppressMembers = shouldSuppressMemberMetrics(mem)
    const suppressClaims = shouldSuppressClaimMetrics(claims, claimsByStatus)

    return {
      suppression: { minimumGroupSize: MIN_PUBLISHABLE_GROUP_SIZE, members: suppressMembers, claims: suppressClaims },
      organizationId: id,
      organizationName: org.name,
      organizationType: org.organizationType,
      totalMembers: suppressMembers ? null : mem.total,
      activeMembers: suppressMembers ? null : mem.active,
      newMembersThisMonth: suppressMembers ? null : mem.new_this_month,
      memberGrowthRate: suppressMembers ? null : memberGrowthRate,
      totalClaims: suppressClaims ? null : claims.total,
      activeClaims: suppressClaims ? null : claims.active,
      resolvedClaims: suppressClaims ? null : claims.resolved,
      claimsThisMonth: suppressClaims ? null : claims.this_month,
      avgResolutionDays: suppressClaims ? null : avgResolutionDays,
      childOrganizations,
      claimsByStatus: suppressClaims ? null : claimsByStatus,
    }
  }

  const analytics =
    access.platform || !access.direct.has(id)
      ? await withSystemContext(() => aggregate(db))
      : await withRLSContext({ organizationId: id }, (tx) => aggregate(tx as unknown as typeof db))

  return NextResponse.json({ data: analytics })
}

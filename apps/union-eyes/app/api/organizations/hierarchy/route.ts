import { NextResponse } from 'next/server'
import { auth } from '@nzila/platform-auth/entra/server'
import { db } from '@/db/db'
import { organizations } from '@/db/schema-organizations'
import { and, ne, asc, inArray, or, eq, sql } from 'drizzle-orm'
import { withSystemContext } from '@/lib/db/with-rls-context'
import { affiliationOrganizationIds, canReadOrganization, directoryProjection, resolveOrganizationAccess } from '@/lib/organizations/read-authority'

export const dynamic = 'force-dynamic'

const MAX_LISTED = 500

/** GET /api/organizations/hierarchy — return all orgs ordered by hierarchy level */
export async function GET(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const rootOrgId = searchParams.get('rootOrgId')

  // Only the organizations the caller is affiliated with are listed: their own memberships and those below an organization they
  // administer. A platform title adds none. The system-role read is not tenant-scoped. Member counts and the profile fields are given
  // only where the caller is a direct member; elsewhere the entry is the directory entry.
  const access = await resolveOrganizationAccess(userId)
  const visible = affiliationOrganizationIds(access)
  if (visible.length === 0) return NextResponse.json({ success: true, data: [] })

  // The root filter runs in the query, before the cap, so a branch is not cut short by organizations outside it; one more row than the
  // cap is read so the answer can say the list was cut.
  const conditions = [
    ne(organizations.organizationType, 'platform'),
    inArray(organizations.id, visible),
    ...(rootOrgId ? [or(eq(organizations.id, rootOrgId), sql`${rootOrgId} = ANY(${organizations.hierarchyPath})`)!] : []),
  ]
  const fetched = await withSystemContext(() =>
    db
      .select()
      .from(organizations)
      .where(and(...conditions))
      .orderBy(asc(organizations.hierarchyLevel), asc(organizations.name))
      .limit(MAX_LISTED + 1),
  )
  const truncated = fetched.length > MAX_LISTED
  const rows = truncated ? fetched.slice(0, MAX_LISTED) : fetched

  const mapped = rows.map((row) => ({
    ...directoryProjection(row),
    parent_organization_id: row.parentId,
    level: row.hierarchyLevel,
    child_count: rows.filter((candidate) => candidate.parentId === row.id).length,
    ...(canReadOrganization(access, row.id)
      ? {
          member_count: row.memberCount,
          active_member_count: row.activeMemberCount,
          sectors: row.sectors,
          clc_affiliated: row.clcAffiliated,
        }
      : {}),
  }))

  return NextResponse.json({ success: true, data: mapped, truncated, limit: MAX_LISTED })
}

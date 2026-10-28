import { NextResponse } from 'next/server'
import { auth } from '@nzila/platform-auth/entra/server'
import { db } from '@/db/db'
import { organizations } from '@/db/schema-organizations'
import { and, ne, asc, inArray } from 'drizzle-orm'
import { withSystemContext } from '@/lib/db/with-rls-context'
import { readableOrganizationIds, resolveOrganizationAccess } from '@/lib/organizations/read-authority'

export const dynamic = 'force-dynamic'

/** GET /api/organizations/hierarchy — return all orgs ordered by hierarchy level */
export async function GET(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const rootOrgId = searchParams.get('rootOrgId')

  // Only the organizations the caller may read are listed: their own memberships, those below an organization they
  // administer, and (for a platform administrator) all. The system-role read is not tenant-scoped.
  const access = await resolveOrganizationAccess(userId)
  const readable = readableOrganizationIds(access)
  if (readable && readable.length === 0) return NextResponse.json({ success: true, data: [] })

  const baseRows = await withSystemContext(() =>
    db
      .select()
      .from(organizations)
      .where(
        readable
          ? and(ne(organizations.organizationType, 'platform'), inArray(organizations.id, readable))
          : ne(organizations.organizationType, 'platform'),
      )
      .orderBy(asc(organizations.hierarchyLevel), asc(organizations.name))
      .limit(500),
  )

  let rows = baseRows
  if (rootOrgId) {
    rows = baseRows.filter(
      (row) => row.id === rootOrgId || (row.hierarchyPath ?? []).includes(rootOrgId),
    )
  }

  const mapped = rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    organization_type: row.organizationType,
    parent_id: row.parentId,
    parent_organization_id: row.parentId,
    hierarchy_path: row.hierarchyPath,
    hierarchy_level: row.hierarchyLevel,
    level: row.hierarchyLevel,
    member_count: row.memberCount,
    active_member_count: row.activeMemberCount,
    child_count: rows.filter((candidate) => candidate.parentId === row.id).length,
    status: row.status,
    sectors: row.sectors,
    clc_affiliated: row.clcAffiliated,
    rls_enabled: true,
  }))

  return NextResponse.json({ success: true, data: mapped })
}

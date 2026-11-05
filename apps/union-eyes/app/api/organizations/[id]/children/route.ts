import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@nzila/platform-auth/entra/server'
import { db } from '@/db/db'
import { organizations } from '@/db/schema-organizations'
import { eq } from 'drizzle-orm'
import { withSystemContext } from '@/lib/db/with-rls-context'
import { canReadOrganization, canSeeAffiliation, directoryProjection, resolveOrganizationAccess, UUID_PATTERN } from '@/lib/organizations/read-authority'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: 'Invalid organization id' }, { status: 400 })

  // The children of an organization are listed only to a caller affiliated with it, and only those children the caller is affiliated with
  // themselves: a member of a federation does not receive its other affiliates. A child the caller is not a direct member of is listed as
  // its directory entry only: an administrator above it does not receive its member counts or profile.
  const access = await resolveOrganizationAccess(userId)
  if (!canSeeAffiliation(access, id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const rows = (
    await withSystemContext(() => db.select().from(organizations).where(eq(organizations.parentId, id)).limit(500))
  ).filter((row) => canSeeAffiliation(access, row.id))

  const mapped = rows.map((row) => {
    if (!canReadOrganization(access, row.id)) return { ...directoryProjection(row), type: row.organizationType }
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      organization_type: row.organizationType,
      type: row.organizationType,
      parent_id: row.parentId,
      hierarchy_path: row.hierarchyPath,
      hierarchy_level: row.hierarchyLevel,
      sectors: row.sectors,
      member_count: row.memberCount,
      memberCount: row.memberCount ?? 0,
      active_member_count: row.activeMemberCount,
      status: row.status,
      clc_affiliated: row.clcAffiliated,
      created_at: row.createdAt,
    }
  })

  return NextResponse.json({ data: mapped })
}

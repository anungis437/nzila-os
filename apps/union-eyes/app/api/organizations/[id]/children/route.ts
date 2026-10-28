import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@nzila/platform-auth/entra/server'
import { db } from '@/db/db'
import { organizations } from '@/db/schema-organizations'
import { eq } from 'drizzle-orm'
import { withSystemContext } from '@/lib/db/with-rls-context'
import { canReadOrganization, resolveOrganizationAccess, UUID_PATTERN } from '@/lib/organizations/read-authority'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: 'Invalid organization id' }, { status: 400 })

  // The children of an organization are listed only to a caller who may read it, and only those children the caller may
  // read themselves: a member of a federation does not receive its other affiliates.
  const access = await resolveOrganizationAccess(userId)
  if (!canReadOrganization(access, id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const rows = (
    await withSystemContext(() => db.select().from(organizations).where(eq(organizations.parentId, id)).limit(500))
  ).filter((row) => canReadOrganization(access, row.id))

  const mapped = rows.map((row) => ({
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
  }))

  return NextResponse.json({ data: mapped })
}

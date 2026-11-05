import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@nzila/platform-auth/entra/server'
import { db } from '@/db/db'
import { organizations } from '@/db/schema-organizations'
import { sql } from 'drizzle-orm'
import { withSystemContext } from '@/lib/db/with-rls-context'
import { canReadOrganization, resolveOrganizationAccess, UUID_PATTERN } from '@/lib/organizations/read-authority'

const MAX_DESCENDANTS = 2000

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

/** GET /api/organizations/:id/descendants — orgs whose hierarchy_path contains this id */
export async function GET(_req: NextRequest, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: 'Invalid organization id' }, { status: 400 })

  const access = await resolveOrganizationAccess(userId)
  if (!canReadOrganization(access, id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const rows = (
    await withSystemContext(() =>
      db
        .select()
        .from(organizations)
        .where(sql`${id} = ANY(${organizations.hierarchyPath}) AND ${organizations.id} != ${id}`)
        .limit(MAX_DESCENDANTS),
    )
  ).filter((row) => canReadOrganization(access, row.id))

  const mapped = rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    organization_type: row.organizationType,
    parent_id: row.parentId,
    hierarchy_path: row.hierarchyPath,
    hierarchy_level: row.hierarchyLevel,
    member_count: row.memberCount,
    status: row.status,
  }))

  return NextResponse.json({ data: mapped })
}

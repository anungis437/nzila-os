import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@nzila/platform-auth/entra/server'
import { organizations } from '@/db/schema-organizations'
import { eq, inArray } from 'drizzle-orm'
import { withSystemContext } from '@/lib/db/with-rls-context'
import { canReadOrganization, resolveOrganizationAccess, UUID_PATTERN } from '@/lib/organizations/read-authority'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: 'Invalid organization id' }, { status: 400 })
  const access = await resolveOrganizationAccess(userId)
  if (!canReadOrganization(access, id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // Get the org to read its hierarchy_path
  const [org] = await withSystemContext((tx) =>
    tx
      .select({ hierarchyPath: organizations.hierarchyPath })
      .from(organizations)
      .where(eq(organizations.id, id)),
  )

  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // hierarchy_path contains ancestor IDs; fetch them
  const ancestorIds = (org.hierarchyPath ?? []).filter((aid) => aid !== id && UUID_PATTERN.test(aid) && canReadOrganization(access, aid))
  if (ancestorIds.length === 0) return NextResponse.json({ data: [] })

  const rows = await withSystemContext((tx) =>
    tx.select().from(organizations).where(inArray(organizations.id, ancestorIds)),
  )

  const mapped = rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    type: row.organizationType,
    organization_type: row.organizationType,
    hierarchy_level: row.hierarchyLevel,
    status: row.status,
  }))

  // Sort by hierarchy level (top-most first)
  mapped.sort((a, b) => a.hierarchy_level - b.hierarchy_level)

  return NextResponse.json({ data: mapped })
}

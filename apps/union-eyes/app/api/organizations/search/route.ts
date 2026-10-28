import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@nzila/platform-auth/entra/server'
import { db } from '@/db/db'
import { organizations } from '@/db/schema-organizations'
import { and, ilike, inArray, or, ne } from 'drizzle-orm'
import { withSystemContext } from '@/lib/db/with-rls-context'
import { readableOrganizationIds, resolveOrganizationAccess } from '@/lib/organizations/read-authority'

export const dynamic = 'force-dynamic'

/** GET /api/organizations/search?q=...  Search the organizations the caller may read by name/slug */
export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const q = (url.searchParams.get('q') ?? url.searchParams.get('query') ?? '').slice(0, 100)

  // The search runs as the system role, which is not tenant-scoped, so it is bound to what the caller may read: a
  // signed-in user could otherwise enumerate every organization of every tenant.
  const access = await resolveOrganizationAccess(userId)
  const readable = readableOrganizationIds(access)
  if (readable && readable.length === 0) return NextResponse.json({ data: [] })
  const text = q ? or(ilike(organizations.name, `%${q}%`), ilike(organizations.slug, `%${q}%`)) : ne(organizations.organizationType, 'platform')

  const rows = await withSystemContext(() =>
    db
      .select()
      .from(organizations)
      .where(readable ? and(text, inArray(organizations.id, readable)) : text)
      .limit(50),
  )

  const mapped = rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    organization_type: row.organizationType,
    parent_id: row.parentId,
    member_count: row.memberCount,
    status: row.status,
    sectors: row.sectors,
  }))

  return NextResponse.json({ data: mapped })
}

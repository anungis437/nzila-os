import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@nzila/platform-auth/entra/server'
import { organizations } from '@/db/schema-organizations'
import { and, asc, ilike, inArray, or, ne, sql } from 'drizzle-orm'
import { likeContaining } from '@/lib/api/like-pattern'
import { withSystemContext } from '@/lib/db/with-rls-context'
import { canAdministerOrganization, readableOrganizationIds, resolveOrganizationAccess } from '@/lib/organizations/read-authority'

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
  // The platform organization and any organization that is not active are never offered, with or without a search term, and the
  // term is matched literally so a bare percent or underscore cannot list the whole directory.
  const listable = and(ne(organizations.organizationType, 'platform'), sql`coalesce(${organizations.status}, 'active') = 'active'`)!
  const text = q ? and(or(ilike(organizations.name, likeContaining(q)), ilike(organizations.slug, likeContaining(q))), listable)! : listable

  const rows = await withSystemContext((tx) =>
    tx
      .select()
      .from(organizations)
      .where(readable ? and(text, inArray(organizations.id, readable)) : text)
      .orderBy(asc(organizations.name), asc(organizations.id))
      .limit(50),
  )

  const mapped = rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    organization_type: row.organizationType,
    parent_id: row.parentId,
    ...(canAdministerOrganization(access, row.id) ? { member_count: row.memberCount } : {}),
    status: row.status,
    sectors: row.sectors,
  }))

  return NextResponse.json({ data: mapped })
}

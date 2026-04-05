import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@nzila/platform-auth/entra/server';
import { db } from '@/db/db';
import { organizations } from '@/db/schema-organizations';
import { ilike, or, ne } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/** GET /api/organizations/search?q=...  Search organizations by name/slug */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get('q') ?? url.searchParams.get('query') ?? '';

  const rows = await db.select().from(organizations).where(
    q
      ? or(
          ilike(organizations.name, `%${q}%`),
          ilike(organizations.slug, `%${q}%`),
        )
      : ne(organizations.organizationType, 'platform'),
  ).limit(50);

  const mapped = rows.map(row => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    organization_type: row.organizationType,
    parent_id: row.parentId,
    member_count: row.memberCount,
    status: row.status,
    sectors: row.sectors,
  }));

  return NextResponse.json({ data: mapped });
}
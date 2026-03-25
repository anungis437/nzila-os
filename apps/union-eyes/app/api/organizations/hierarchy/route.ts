import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db/db';
import { organizations } from '@/db/schema-organizations';
import { ne, asc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/** GET /api/organizations/hierarchy — return all orgs ordered by hierarchy level */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await db.select().from(organizations)
    .where(ne(organizations.organizationType, 'platform'))
    .orderBy(asc(organizations.hierarchyLevel), asc(organizations.name))
    .limit(500);

  const mapped = rows.map(row => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    organization_type: row.organizationType,
    parent_id: row.parentId,
    hierarchy_path: row.hierarchyPath,
    hierarchy_level: row.hierarchyLevel,
    member_count: row.memberCount,
    active_member_count: row.activeMemberCount,
    status: row.status,
    sectors: row.sectors,
    clc_affiliated: row.clcAffiliated,
  }));

  return NextResponse.json({ data: mapped });
}
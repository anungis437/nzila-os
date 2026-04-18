import { NextResponse } from 'next/server';
import { auth } from '@nzila/platform-auth/entra/server';
import { db } from '@/db/db';
import { organizations } from '@/db/schema-organizations';
import { ne, asc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/** GET /api/organizations/hierarchy — return all orgs ordered by hierarchy level */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const rootOrgId = searchParams.get('rootOrgId');

  const baseRows = await db.select().from(organizations)
    .where(ne(organizations.organizationType, 'platform'))
    .orderBy(asc(organizations.hierarchyLevel), asc(organizations.name))
    .limit(500);

  let rows = baseRows;
  if (rootOrgId) {
    rows = baseRows.filter((row) =>
      row.id === rootOrgId || (row.hierarchyPath ?? []).includes(rootOrgId),
    );
  }

  const mapped = rows.map(row => ({
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
  }));

  return NextResponse.json({ success: true, data: mapped });
}
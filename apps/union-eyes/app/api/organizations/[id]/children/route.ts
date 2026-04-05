import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@nzila/platform-auth/entra/server';
import { db } from '@/db/db';
import { organizations } from '@/db/schema-organizations';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const rows = await db.select().from(organizations).where(eq(organizations.parentId, id));

  const mapped = rows.map(row => ({
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
  }));

  return NextResponse.json({ data: mapped });
}
/**
 * GET /api/organizations/[id]/path
 *
 * Returns the hierarchy path from root to the given organization (breadcrumb chain).
 * Replaces Django proxy with direct Drizzle/PostgreSQL query.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db/db';
import { organizations } from '@/db/schema-organizations';
import { eq, inArray } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

type OrgRow = typeof organizations.$inferSelect;
function formatOrg(o: OrgRow) {
  return {
    id: o.id,
    name: o.name,
    slug: o.slug,
    type: o.organizationType ?? 'union',
    parentId: o.parentId ?? null,
    sector: (o.sectors ?? [])[0] ?? null,
    jurisdiction: o.provinceTerritory ?? null,
    description: o.description ?? null,
    hierarchyLevel: o.hierarchyLevel ?? 0,
    createdAt: o.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: o.updatedAt?.toISOString() ?? new Date().toISOString(),
  };
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Lookup org by UUID (id param is always the UUID from OrganizationContext)
  const rows = await db
    .select()
    .from(organizations)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(organizations.id, id as any))
    .limit(1);

  const org = rows[0];
  if (!org) {
    return NextResponse.json({ data: [] });
  }

  const path: ReturnType<typeof formatOrg>[] = [];

  // hierarchyPath stores ordered ancestor UUIDs (root first, org last).
  // Fetch all ancestors in one query then sort by level.
  const ancestorIds = (org.hierarchyPath ?? []).filter(
    (anc) => anc !== org.id,
  );

  if (ancestorIds.length > 0) {
    const ancestors = await db
      .select()
      .from(organizations)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .where(inArray(organizations.id, ancestorIds as any));

    ancestors.sort(
      (a, b) => (a.hierarchyLevel ?? 0) - (b.hierarchyLevel ?? 0),
    );
    path.push(...ancestors.map(formatOrg));
  }

  path.push(formatOrg(org));

  return NextResponse.json({ data: path });
}
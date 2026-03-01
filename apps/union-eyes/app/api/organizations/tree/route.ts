/**
 * GET /api/organizations/tree
 *
 * Returns all organizations in a flat list (client builds tree from parentId).
 * Replaces Django proxy with direct Drizzle/PostgreSQL query.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db/db';
import { organizations } from '@/db/schema-organizations';
import { asc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orgs = await db
    .select()
    .from(organizations)
    .orderBy(asc(organizations.hierarchyLevel), asc(organizations.name));

  return NextResponse.json({
    data: orgs.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      type: o.organizationType ?? 'union',
      parentId: o.parentId ?? null,
      sector: (o.sectors ?? [])[0] ?? null,
      jurisdiction: o.provinceTerritory ?? null,
      description: o.description ?? null,
      hierarchyLevel: o.hierarchyLevel ?? 0,
      memberCount: o.memberCount ?? 0,
      status: o.status ?? 'active',
      createdAt: o.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: o.updatedAt?.toISOString() ?? new Date().toISOString(),
    })),
  });
}
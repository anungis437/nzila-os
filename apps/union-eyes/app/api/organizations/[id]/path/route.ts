/**
 * GET /api/organizations/[id]/path
 *
 * Returns the hierarchy path from root to the given organization (breadcrumb chain).
 * Replaces Django proxy with direct Drizzle/PostgreSQL query.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@nzila/platform-auth/entra/server';
import { db } from '@/db/db';
import { organizations } from '@/db/schema-organizations';
import { eq, inArray } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

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
  const lookupByUuid = isUuid(id);

  // Accept either UUID or slug to support mixed legacy test data.
  const rows = await db
    .select()
    .from(organizations)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(lookupByUuid ? eq(organizations.id, id as unknown) : eq(organizations.slug, id as unknown))
    .limit(1);

  const org = rows[0];
  if (!org) {
    return NextResponse.json({ data: [] });
  }

  const path: ReturnType<typeof formatOrg>[] = [];

  const hierarchyTokens = (org.hierarchyPath ?? []).filter(
    (token) => token && token !== org.id && token !== org.slug,
  );

  if (hierarchyTokens.length > 0) {
    const uuidTokens = hierarchyTokens.filter(isUuid);
    const slugTokens = hierarchyTokens.filter((token) => !isUuid(token));

    const [uuidAncestors, slugAncestors] = await Promise.all([
      uuidTokens.length > 0
        ? db
            .select()
            .from(organizations)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .where(inArray(organizations.id, uuidTokens as unknown))
        : Promise.resolve([]),
      slugTokens.length > 0
        ? db
            .select()
            .from(organizations)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .where(inArray(organizations.slug, slugTokens as unknown))
        : Promise.resolve([]),
    ]);

    const ancestorByToken = new Map<string, OrgRow>();
    for (const ancestor of [...uuidAncestors, ...slugAncestors]) {
      ancestorByToken.set(ancestor.id, ancestor);
      if (ancestor.slug) {
        ancestorByToken.set(ancestor.slug, ancestor);
      }
    }

    for (const token of hierarchyTokens) {
      const ancestor = ancestorByToken.get(token);
      if (!ancestor) continue;
      if (path.some((entry) => entry.id === ancestor.id)) continue;
      path.push(formatOrg(ancestor));
    }
  }

  path.push(formatOrg(org));

  return NextResponse.json({ data: path });
}
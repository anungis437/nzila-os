/**
 * GET /api/organizations/tree
 *
 * V2 returns only active private-member organizations (client builds a scoped tree).
 * Flag-off retains the legacy flat organization list.
 * Replaces Django proxy with direct Drizzle/PostgreSQL query.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@nzila/platform-auth/entra/server';
import { db } from '@/db/db';
import { organizations } from '@/db/schema-organizations';
import { asc, inArray } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { currentStateContextEnabled } from '@/lib/auth/canonical-bootstrap';
import { readableOrganizationIds, resolveOrganizationAccess } from '@/lib/organizations/read-authority';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  if (currentStateContextEnabled()) {
    const { getCanonicalOrganizationTree, canonicalOrganizationError } =
      await import('@/lib/auth/canonical-organization-selection')
    try {
      return NextResponse.json(await getCanonicalOrganizationTree())
    } catch (error) {
      return canonicalOrganizationError(error, 'load hierarchy for')
    }
  }
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = await resolveOrganizationAccess(userId);
  const readable = readableOrganizationIds(access);
  if (readable && readable.length === 0) return NextResponse.json({ data: [] });

  // Read as the system role, bounded to the organizations the caller may read; the ambient connection role is not tenant-scoped.
  const orgs = await withSystemContext(() =>
    db
      .select()
      .from(organizations)
      .where(readable ? inArray(organizations.id, readable) : undefined)
      .orderBy(asc(organizations.hierarchyLevel), asc(organizations.name))
      .limit(1000),
  );

  return NextResponse.json({
    data: orgs.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      organization_type: o.organizationType ?? 'union',
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
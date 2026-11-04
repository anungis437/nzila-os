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
import { organizationWire } from '@/lib/organizations/organization-wire';

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
      ...organizationWire(o),
      organization_type: o.organizationType,
      hierarchyLevel: o.hierarchyLevel ?? 0,
      // memberCount keeps the 0 older callers read; member_count is null where the count was never computed, which is not zero.
      member_count: o.memberCount,
      memberCount: o.memberCount ?? 0,
      status: o.status ?? 'active',
    })),
  });
}
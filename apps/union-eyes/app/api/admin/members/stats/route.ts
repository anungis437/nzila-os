/**
 * Admin Members Stats API
 * Returns the member counts of one organization the caller administers.
 *
 * Member counts are a union's roster content. A platform title (the platform_lead floor below) is not authority over any organization's
 * roster, even as an aggregate (issues #1116, #1118; DEF-0B1-PLATFORM-ROLE-TITLE-AUTHORITY), and cross-organization grants are not built:
 * - without an organizationId the request asked for every organization's roster counted together, and is refused without a read;
 * - with one, the caller must hold a live, direct administrative membership in that exact organization (another organization answers 404,
 *   as an organization the caller cannot see), and the counts are read under that organization's own RLS context.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@nzila/platform-auth/entra/server';
import { db } from '@/db/db';
import { organizationMembers } from '@/db/schema';
import { eq, and, isNull, sql, inArray } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { hasMinRole } from '@/lib/api-auth-guard';
import { directRoleIn, isAdministrativeRole, resolveOrganizationAccess, UUID_PATTERN } from '@/lib/organizations/read-authority';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const canAccess = await hasMinRole('platform_lead');
  if (!canAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const orgId = req.nextUrl.searchParams.get('organizationId');
  if (!orgId) {
    return NextResponse.json(
      { error: 'Member counts across organizations are not available: they are tenant content, and no cross-organization grant exists.' },
      { status: 403 },
    );
  }
  if (!UUID_PATTERN.test(orgId)) {
    return NextResponse.json({ error: 'organizationId must be an organization id' }, { status: 400 });
  }

  const access = await resolveOrganizationAccess(userId);
  if (!isAdministrativeRole(directRoleIn(access, orgId))) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  const stats = await withRLSContext({ organizationId: orgId, userId }, async () => {
    const baseWhere = and(eq(organizationMembers.organizationId, orgId), isNull(organizationMembers.deletedAt));
    const activeWhere = and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.status, 'active'), isNull(organizationMembers.deletedAt));

    const stewardRoles = ['steward', 'chief_steward'];
    const stewardWhere = and(eq(organizationMembers.organizationId, orgId), inArray(organizationMembers.role, stewardRoles), isNull(organizationMembers.deletedAt));

    const officerRoles = ['officer', 'president', 'vice_president', 'secretary_treasurer', 'national_officer', 'federation_exec'];
    const officerWhere = and(eq(organizationMembers.organizationId, orgId), inArray(organizationMembers.role, officerRoles), isNull(organizationMembers.deletedAt));

    const [total, active, stewards, officers] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(organizationMembers).where(baseWhere),
      db.select({ count: sql<number>`count(*)::int` }).from(organizationMembers).where(activeWhere),
      db.select({ count: sql<number>`count(*)::int` }).from(organizationMembers).where(stewardWhere),
      db.select({ count: sql<number>`count(*)::int` }).from(organizationMembers).where(officerWhere),
    ]);

    return {
      total: total[0]?.count ?? 0,
      active: active[0]?.count ?? 0,
      stewards: stewards[0]?.count ?? 0,
      officers: officers[0]?.count ?? 0,
    };
  });

  return NextResponse.json(stats);
}

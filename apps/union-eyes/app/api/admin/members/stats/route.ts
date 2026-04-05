/**
 * Admin Members Stats API
 * Returns aggregate member counts across all organizations (or filtered by org).
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@nzila/platform-auth/entra/server';
import { db } from '@/db/db';
import { organizationMembers } from '@/db/schema';
import { eq, and, isNull, sql, inArray } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orgId = req.nextUrl.searchParams.get('organizationId');

  const stats = await withRLSContext(async () => {
    const baseWhere = orgId
      ? and(eq(organizationMembers.organizationId, orgId), isNull(organizationMembers.deletedAt))
      : isNull(organizationMembers.deletedAt);

    const activeWhere = orgId
      ? and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.status, 'active'), isNull(organizationMembers.deletedAt))
      : and(eq(organizationMembers.status, 'active'), isNull(organizationMembers.deletedAt));

    const stewardRoles = ['steward', 'chief_steward'];
    const stewardWhere = orgId
      ? and(eq(organizationMembers.organizationId, orgId), inArray(organizationMembers.role, stewardRoles), isNull(organizationMembers.deletedAt))
      : and(inArray(organizationMembers.role, stewardRoles), isNull(organizationMembers.deletedAt));

    const officerRoles = ['officer', 'president', 'vice_president', 'secretary_treasurer', 'national_officer', 'federation_exec'];
    const officerWhere = orgId
      ? and(eq(organizationMembers.organizationId, orgId), inArray(organizationMembers.role, officerRoles), isNull(organizationMembers.deletedAt))
      : and(inArray(organizationMembers.role, officerRoles), isNull(organizationMembers.deletedAt));

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

/**
 * Read-only cross-organization access history, scoped to the resource owner.
 * No public CRUD factory over organizations, no mutation methods.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@nzila/platform-auth/entra/server';
import { desc, eq } from 'drizzle-orm';
import { crossOrgAccessLog } from '@/db/schema';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { isAdministrativeRole, resolveOrganizationAccess, UUID_PATTERN } from '@/lib/organizations/read-authority';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: 'Invalid organization id' }, { status: 400 });

  const access = await resolveOrganizationAccess(userId);
  if (!isAdministrativeRole(access.direct.get(id))) {
    return NextResponse.json({ error: 'Forbidden: direct organization administrator required' }, { status: 403 });
  }

  const url = new URL(req.url);
  const pageRaw = Number(url.searchParams.get('page') ?? '1');
  const limitRaw = Number(url.searchParams.get('limit') ?? '50');
  const page = Number.isSafeInteger(pageRaw) && pageRaw > 0 ? Math.min(pageRaw, 100000) : 1;
  const limit = Number.isSafeInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 50;

  const data = await withRLSContext({ organizationId: id }, async tx =>
    tx.select({
      id: crossOrgAccessLog.id,
      userOrganizationId: crossOrgAccessLog.userOrganizationId,
      resourceType: crossOrgAccessLog.resourceType,
      resourceId: crossOrgAccessLog.resourceId,
      accessType: crossOrgAccessLog.accessType,
      accessGrantedVia: crossOrgAccessLog.accessGrantedVia,
      createdAt: crossOrgAccessLog.createdAt,
    }).from(crossOrgAccessLog)
      .where(eq(crossOrgAccessLog.resourceOrganizationId, id))
      .orderBy(desc(crossOrgAccessLog.createdAt))
      .limit(limit).offset((page - 1) * limit),
  );

  // Neither external actor identity nor IP/device/opaque metadata are released
  // to the tenant. Privileged security investigations have their own mandate.
  return NextResponse.json({ data, page, limit });
}

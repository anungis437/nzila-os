import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { authenticateWithOrg, requirePermission, withRequestContext } from '@/lib/api-guards';
import { getDashboardSummary } from '@/modules/incidents/service';

export async function GET(request: NextRequest): Promise<NextResponse> {
  return withRequestContext(request, async () => {
    const authz = await authenticateWithOrg(request);
    if (!authz.ok) return authz.response;

    const permission = requirePermission(request, 'dashboard.read');
    if (!permission.ok) return permission.response;

    const summary = await getDashboardSummary(authz.orgId);
    return NextResponse.json({ item: summary });
  });
}

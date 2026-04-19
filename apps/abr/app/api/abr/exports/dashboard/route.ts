import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { authenticateWithOrg, requirePermission, withRequestContext } from '@/lib/api-guards';
import { exportDashboardCsv, getDashboardSummary } from '@/modules/incidents/service';

export async function GET(request: NextRequest): Promise<NextResponse> {
  return withRequestContext(request, async () => {
    const authz = await authenticateWithOrg(request);
    if (!authz.ok) return authz.response;

    const permission = requirePermission(request, 'export.read');
    if (!permission.ok) return permission.response;

    const format = request.nextUrl.searchParams.get('format') ?? 'json';

    if (format === 'csv') {
      const csv = await exportDashboardCsv(authz.orgId);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="abr-dashboard-quarterly.csv"',
        },
      });
    }

    const output = await getDashboardSummary(authz.orgId);
    return NextResponse.json({ generatedAt: new Date().toISOString(), item: output });
  });
}

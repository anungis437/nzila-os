import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { authenticateWithOrg, requirePermission, withRequestContext } from '@/lib/api-guards';
import { resolveDataMode } from '@/lib/data-mode';
import { buildIncidentExport } from '@/modules/governance/export';

export async function GET(request: NextRequest): Promise<NextResponse> {
  return withRequestContext(request, async () => {
    const authz = await authenticateWithOrg(request);
    if (!authz.ok) return authz.response;

    const permission = requirePermission(request, 'export.read');
    if (!permission.ok) return permission.response;

    const dataMode = resolveDataMode({
      demo: request.nextUrl.searchParams.get('demo') ?? undefined,
      mode: request.nextUrl.searchParams.get('mode') ?? undefined,
    });
    const format = request.nextUrl.searchParams.get('format') ?? 'json';
    const artifact = await buildIncidentExport({
      orgId: authz.orgId,
      role: permission.role,
      dataMode: dataMode.mode,
    });

    if (format === 'csv') {
      return new NextResponse(String(artifact.csv.payload), {
        status: 200,
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="${artifact.csv.filename}"`,
        },
      });
    }

    return NextResponse.json(artifact.json.payload);
  });
}

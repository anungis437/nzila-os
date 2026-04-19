import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { authenticateWithOrg, requirePermission, withRequestContext } from '@/lib/api-guards';
import { resolveDataMode } from '@/lib/data-mode';
import { buildExecutiveSummaryExport } from '@/modules/governance/export';

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
    const format = request.nextUrl.searchParams.get('format') ?? 'markdown';
    const artifact = await buildExecutiveSummaryExport({
      orgId: authz.orgId,
      role: permission.role,
      dataMode: dataMode.mode,
    });

    if (format === 'markdown') {
      const markdown = String((artifact.payload as { markdown: string }).markdown);
      return new NextResponse(markdown, {
        status: 200,
        headers: {
          'content-type': 'text/markdown; charset=utf-8',
          'content-disposition': `attachment; filename="${artifact.filename}"`,
        },
      });
    }

    return NextResponse.json(artifact.payload);
  });
}

/**
 * Platform Admin — SAGE export package internal download API
 *
 * GET /api/sage/workspaces/[workspaceId]/export-packages/[packageId]/download
 *
 * Authenticated, server-side INTERNAL retrieval of package bytes. There is NO
 * public URL, NO bearer token, and NO external delivery. Access is re-checked
 * (membership + export authority or original ownership) in-service and audited
 * by identifiers only. Bytes are streamed with a safe attachment filename and
 * private, no-store cache headers.
 */
import { NextRequest, NextResponse } from 'next/server'
import { withOrgScope } from '@/lib/org-scope-guard'
import { downloadSageExportPackageForScope } from '@/lib/sage/export-service'
import { sageErrorResponse, sageNotFoundResponse } from '@/lib/sage/route-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string; packageId: string }> },
) {
  const { workspaceId, packageId } = await context.params
  return withOrgScope(request, async (ctx) => {
    try {
      const result = await downloadSageExportPackageForScope(ctx, workspaceId, packageId)
      if (!result) return sageNotFoundResponse()
      // Safe filename (uuid-based); never a recipient/external destination.
      const safeName = result.filename.replace(/[^a-zA-Z0-9._-]/g, '_')
      return new NextResponse(result.bytes as unknown as BodyInit, {
        status: 200,
        headers: {
          'Content-Type': result.mediaType,
          'Content-Disposition': `attachment; filename="${safeName}"`,
          'Cache-Control': 'no-store, private',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    } catch (error) {
      return sageErrorResponse(error)
    }
  })
}

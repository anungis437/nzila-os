/**
 * Platform Admin — SAGE export package detail API
 *
 * GET /api/sage/workspaces/[workspaceId]/export-packages/[packageId]
 *
 * Tenant-scoped package metadata. Package bytes are served only by the
 * authenticated internal download route. Packages are immutable — no mutation.
 */
import { NextRequest, NextResponse } from 'next/server'
import { withOrgScope } from '@/lib/org-scope-guard'
import { getSageExportPackageForScope } from '@/lib/sage/export-service'
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
      const data = await getSageExportPackageForScope(ctx, workspaceId, packageId)
      if (!data) return sageNotFoundResponse()
      return NextResponse.json({ ok: true, data })
    } catch (error) {
      return sageErrorResponse(error)
    }
  })
}

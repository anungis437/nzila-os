/**
 * Platform Admin — SAGE export packages API
 *
 * GET /api/sage/workspaces/[workspaceId]/export-packages — list generated packages
 *
 * Tenant-scoped package metadata (hashes, counts, status). Package CONTENT is
 * only retrievable through the authenticated internal download route.
 */
import { NextRequest, NextResponse } from 'next/server'
import { withOrgScope } from '@/lib/org-scope-guard'
import { listSageExportPackagesForScope } from '@/lib/sage/export-service'
import { sageErrorResponse, sageNotFoundResponse } from '@/lib/sage/route-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await context.params
  return withOrgScope(request, async (ctx) => {
    try {
      const data = await listSageExportPackagesForScope(ctx, workspaceId)
      if (!data) return sageNotFoundResponse()
      return NextResponse.json({ ok: true, data })
    } catch (error) {
      return sageErrorResponse(error)
    }
  })
}

/**
 * Platform Admin — SAGE export request detail API
 *
 * GET /api/sage/workspaces/[workspaceId]/export-requests/[requestId]
 *
 * Tenant-scoped detail: the request plus its approval/denial decisions. A
 * missing / cross-org / cross-workspace / inaccessible request resolves to 404.
 */
import { NextRequest, NextResponse } from 'next/server'
import { withOrgScope } from '@/lib/org-scope-guard'
import {
  getSageExportRequestForScope,
  listSageExportApprovalsForScope,
} from '@/lib/sage/export-service'
import { sageErrorResponse, sageNotFoundResponse } from '@/lib/sage/route-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string; requestId: string }> },
) {
  const { workspaceId, requestId } = await context.params
  return withOrgScope(request, async (ctx) => {
    try {
      const req = await getSageExportRequestForScope(ctx, workspaceId, requestId)
      if (!req) return sageNotFoundResponse()
      const approvals = await listSageExportApprovalsForScope(ctx, workspaceId, requestId)
      return NextResponse.json({ ok: true, data: { request: req, approvals: approvals?.approvals ?? [] } })
    } catch (error) {
      return sageErrorResponse(error)
    }
  })
}

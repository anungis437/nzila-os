/**
 * Platform Admin — SAGE workspace summary API
 *
 * GET /api/sage/workspaces/[workspaceId]/summary — counts + status only.
 *
 * The response contains no score, rank, grade, certification, or automated
 * conclusion. Tenant-scoped: cross-org/missing returns 404 (non-disclosure).
 */
import { NextRequest, NextResponse } from 'next/server'
import { withOrgScope } from '../../../../../../lib/org-scope-guard'
import { getSageWorkspaceSummaryForScope } from '../../../../../../lib/sage/workspace-service'
import { sageErrorResponse, sageNotFoundResponse } from '../../../../../../lib/sage/route-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await context.params
  return withOrgScope(request, async (ctx) => {
    try {
      const data = await getSageWorkspaceSummaryForScope(ctx, workspaceId)
      if (!data) return sageNotFoundResponse()
      return NextResponse.json({ ok: true, data })
    } catch (error) {
      return sageErrorResponse(error)
    }
  })
}

/**
 * Platform Admin — SAGE workspace detail API
 *
 * GET /api/sage/workspaces/[workspaceId] — org-scoped workspace detail.
 *
 * Tenant-scoped: a missing or cross-org workspace returns 404 (non-disclosure),
 * never leaking whether a workspace exists in another organization.
 */
import { NextRequest, NextResponse } from 'next/server'
import { withOrgScope } from '../../../../../lib/org-scope-guard'
import { getSageWorkspaceForScope } from '../../../../../lib/sage/workspace-service'
import { sageErrorResponse, sageNotFoundResponse } from '../../../../../lib/sage/route-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await context.params
  return withOrgScope(request, async (ctx) => {
    try {
      const data = await getSageWorkspaceForScope(ctx, workspaceId)
      if (!data) return sageNotFoundResponse()
      return NextResponse.json({ ok: true, data })
    } catch (error) {
      return sageErrorResponse(error)
    }
  })
}

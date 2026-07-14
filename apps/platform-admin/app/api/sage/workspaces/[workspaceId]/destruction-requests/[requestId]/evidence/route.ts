/**
 * Platform Admin — SAGE Phase 8B destruction evidence API
 *
 * GET /api/sage/workspaces/[workspaceId]/destruction-requests/[requestId]/evidence
 *
 * Returns the immutable destruction evidence for a request (safe fields only —
 * hashed storage reference, safe result/error codes; never raw references).
 */
import { NextRequest, NextResponse } from 'next/server'
import { withOrgScope } from '@/lib/org-scope-guard'
import { getDestructionEvidenceForScope } from '@/lib/sage/records-service'
import { sageErrorResponse } from '@/lib/sage/route-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string; requestId: string }> },
) {
  const { workspaceId, requestId } = await context.params
  return withOrgScope(request, async (ctx) => {
    try {
      const data = await getDestructionEvidenceForScope(ctx, { workspaceId, requestId })
      return NextResponse.json({ ok: true, data })
    } catch (error) {
      return sageErrorResponse(error)
    }
  })
}

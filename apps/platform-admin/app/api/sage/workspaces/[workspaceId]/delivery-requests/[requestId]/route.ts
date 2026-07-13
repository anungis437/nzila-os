/**
 * Platform Admin — SAGE delivery request detail API
 *
 * GET /api/sage/workspaces/[workspaceId]/delivery-requests/[requestId]
 */
import { NextRequest, NextResponse } from 'next/server'
import { withOrgScope } from '@/lib/org-scope-guard'
import { getDeliveryRequestForScope } from '@/lib/sage/delivery-service'
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
      const data = await getDeliveryRequestForScope(ctx, workspaceId, requestId)
      if (!data) return sageNotFoundResponse()
      return NextResponse.json({ ok: true, data })
    } catch (error) {
      return sageErrorResponse(error)
    }
  })
}

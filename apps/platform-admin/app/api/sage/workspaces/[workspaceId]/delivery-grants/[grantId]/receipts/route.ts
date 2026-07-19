/**
 * Platform Admin — SAGE delivery grant receipts API
 *
 * GET /api/sage/workspaces/[workspaceId]/delivery-grants/[grantId]/receipts
 *
 * Durable delivery receipts for one grant. Receipts carry only safe codes — no
 * email, token, IP, user-agent, or narrative.
 */
import { NextRequest, NextResponse } from 'next/server'
import { withOrgScope } from '@/lib/org-scope-guard'
import { listDeliveryReceiptsForScope } from '@/lib/sage/delivery-service'
import { sageErrorResponse, sageNotFoundResponse } from '@/lib/sage/route-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string; grantId: string }> },
) {
  const { workspaceId, grantId } = await context.params
  return withOrgScope(request, async (ctx) => {
    try {
      const data = await listDeliveryReceiptsForScope(ctx, workspaceId, grantId)
      if (!data) return sageNotFoundResponse()
      return NextResponse.json({ ok: true, data })
    } catch (error) {
      return sageErrorResponse(error)
    }
  })
}

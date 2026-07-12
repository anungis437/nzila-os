/**
 * Platform Admin — SAGE decision record detail API
 *
 * GET /api/sage/workspaces/[workspaceId]/decisions/[decisionId]
 *
 * Tenant-scoped detail. Referenced evidence is filtered to what the actor may
 * access. A missing / cross-org / cross-workspace / inaccessible decision
 * resolves to 404 (non-disclosure). Decision records are immutable — there is
 * no PUT/PATCH/DELETE.
 */
import { NextRequest, NextResponse } from 'next/server'
import { withOrgScope } from '@/lib/org-scope-guard'
import { getSageDecisionRecordForScope } from '@/lib/sage/governance-service'
import { sageErrorResponse, sageNotFoundResponse } from '@/lib/sage/route-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string; decisionId: string }> },
) {
  const { workspaceId, decisionId } = await context.params
  return withOrgScope(request, async (ctx) => {
    try {
      const data = await getSageDecisionRecordForScope(ctx, workspaceId, decisionId)
      if (!data) return sageNotFoundResponse()
      return NextResponse.json({ ok: true, data })
    } catch (error) {
      return sageErrorResponse(error)
    }
  })
}

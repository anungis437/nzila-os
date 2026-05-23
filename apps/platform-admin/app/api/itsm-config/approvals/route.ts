/**
 * Platform Admin — ITSM Approvals API
 *
 * GET /api/itsm-config/approvals?status=pending|approved|rejected|escalated
 *   List approvals for the org. Defaults to all statuses.
 *
 * Mutations (decide, escalate) live in /api/itsm-config/approvals/[id].
 */
import { NextRequest, NextResponse } from 'next/server'
import { withOrgScope } from '../../../../lib/org-scope-guard'
import { listApprovals, getApprovalStats } from '../../../../lib/itsm-queries'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_STATUSES = ['pending', 'approved', 'rejected', 'escalated'] as const

export async function GET(request: NextRequest) {
  return withOrgScope(request, async (ctx) => {
    const statusParam = request.nextUrl.searchParams.get('status')
    const status =
      statusParam && (ALLOWED_STATUSES as readonly string[]).includes(statusParam)
        ? (statusParam as (typeof ALLOWED_STATUSES)[number])
        : undefined
    const [rows, stats] = await Promise.all([
      listApprovals(ctx.orgId, { status }),
      getApprovalStats(ctx.orgId),
    ])
    return NextResponse.json({ ok: true, data: { approvals: rows, stats } })
  })
}

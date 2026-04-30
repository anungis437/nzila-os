import { NextRequest, NextResponse } from 'next/server'
import { authorize } from '@/lib/api-authorization'

const requireOrgAccess = authorize
import { evaluateApproval, type ApprovalAction } from '@/lib/approval-policy'

export async function POST(request: NextRequest) {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())
  const auth = requireOrgAccess(searchParams, 'quote.manage', 'approval.evaluate', 'policy:threshold-check')
  if (auth.response) return auth.response

  const body = (await request.json()) as {
    action: ApprovalAction
    value: number
    marginPercent?: number
  }
  const decision = evaluateApproval(body)

  return NextResponse.json({
    ok: true,
    actor: auth.actor.displayName,
    decision,
  })
}

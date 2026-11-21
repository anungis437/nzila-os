import { generateStripeMonthlyReportsAction } from '@/lib/services/ai-proposal-service'
import { FinanceStripeMonthlyReportsProposalSchema } from '@nzila/ai-core'
// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Convenience: Generate Stripe Monthly Reports (AI Action)
 * POST /api/ai/actions/finance/stripe-monthly-reports
 *
 * Wraps propose + execute in one flow for auto-approved low-risk actions.
 */
import { NextRequest, NextResponse } from 'next/server'

import { createLogger } from '@nzila/os-core'

import { requireOrgAccess } from '@/lib/api-guards'
import { asAiError } from '@/lib/catch-utils'

const logger = createLogger('ai:actions:finance:stripe-monthly-reports')

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Validate proposal
    const parsed = FinanceStripeMonthlyReportsProposalSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const proposal = parsed.data
    const access = await requireOrgAccess(proposal.orgId, {
      minRole: 'org_secretary',
    })
    if (!access.ok) return access.response

    const result = await generateStripeMonthlyReportsAction(proposal, access.context.userId)
    return NextResponse.json(result.body, { status: result.status })
  } catch (err) {
    const aiErr = asAiError(err)
    if (aiErr) {
      return NextResponse.json(
        { error: aiErr.message, code: aiErr.code },
        { status: aiErr.statusCode },
      )
    }
    logger.error('[Stripe Monthly Reports Error]', err instanceof Error ? err : { detail: err })
    return NextResponse.json({ error: 'Internal server error', code: 'unknown' }, { status: 500 })
  }
}

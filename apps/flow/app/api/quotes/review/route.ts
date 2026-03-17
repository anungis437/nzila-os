/**
 * ShopMoiCa — Submit Quote for Review API
 *
 * Transitions a quote from DRAFT to INTERNAL_REVIEW.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticateUser, withRequestContext } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { quoteRepo } from '@/lib/db'
import { resolveOrgContext } from '@/lib/resolve-org'
import { attemptQuoteTransition } from '@/lib/workflows/quote-state-machine'
import { emitWorkflowAuditEvent } from '@/lib/services/workflow-audit-service'
import { recordTimelineEvent } from '@/lib/repositories/workflow-repository'

const ReviewInput = z.object({
  quoteId: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  return withRequestContext(request, async () =>
    withSpan('api.quotes.review', { 'http.method': 'POST' }, async () => {
    const authResult = await authenticateUser()
    if (!authResult.ok) return authResult.response

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const parsed = ReviewInput.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const ctx = await resolveOrgContext()
    const quote = await quoteRepo.findById(parsed.data.quoteId)
    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const current = quote.status.toUpperCase()
    const transition = attemptQuoteTransition(
      current as 'DRAFT',
      'INTERNAL_REVIEW',
    )
    if (!transition.ok) {
      return NextResponse.json({ error: transition.reason }, { status: 400 })
    }

    await quoteRepo.update(parsed.data.quoteId, { status: 'INTERNAL_REVIEW' })

    await recordTimelineEvent({
      quoteId: parsed.data.quoteId,
      event: 'submitted_for_review',
      description: 'Quote submitted for internal review',
      actor: authResult.userId,
      metadata: { fromStatus: current, toStatus: 'INTERNAL_REVIEW' },
    })

    emitWorkflowAuditEvent({
      event: 'quote_submitted_for_review',
      quoteId: parsed.data.quoteId,
      orgId: ctx.orgId,
      userId: authResult.userId,
      metadata: { fromStatus: current, toStatus: 'INTERNAL_REVIEW' },
    })

    return NextResponse.json({ ok: true, status: 'INTERNAL_REVIEW' })
  }))
}

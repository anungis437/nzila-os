/**
 * ShopMoiCa — Send Quote API
 *
 * Generates a secure approval link and transitions quote to SENT_TO_CLIENT.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticateUser, withRequestContext } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { quoteRepo } from '@/lib/db'
import { resolveOrgContext } from '@/lib/resolve-org'
import { attemptQuoteTransition } from '@/lib/workflows/quote-state-machine'
import { createShareLink } from '@/lib/services/share-link-service'
import { emitWorkflowAuditEvent } from '@/lib/services/workflow-audit-service'
import { recordTimelineEvent } from '@/lib/repositories/workflow-repository'
import { getOrgSettings } from '@nzila/platform-commerce-org/service'

const SendInput = z.object({
  quoteId: z.string().uuid(),
  expiresInDays: z.number().int().min(1).max(90).optional(),
})

export async function POST(request: NextRequest) {
  return withRequestContext(request, async () => withSpan('api.quotes.send', { 'http.method': 'POST' }, async () => {
    const authResult = await authenticateUser()
    if (!authResult.ok) return authResult.response

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const parsed = SendInput.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const ctx = await resolveOrgContext()
    const orgSettings = await getOrgSettings(ctx.orgId)
    const expiresInDays = parsed.data.expiresInDays ?? orgSettings.shareLinkExpiryDays
    const quote = await quoteRepo.findById(parsed.data.quoteId)
    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const current = quote.status.toUpperCase()
    const transition = attemptQuoteTransition(
      current as 'INTERNAL_REVIEW',
      'SENT_TO_CLIENT',
    )
    if (!transition.ok) {
      return NextResponse.json({ error: transition.reason }, { status: 400 })
    }

    const { link, rawToken } = await createShareLink(
      {
        quoteId: parsed.data.quoteId,
        expiresInDays,
        createdBy: authResult.userId,
      },
      ctx.orgId,
    )

    await quoteRepo.update(parsed.data.quoteId, { status: 'SENT_TO_CLIENT' })

    await recordTimelineEvent({
      quoteId: parsed.data.quoteId,
      event: 'sent_to_client',
      description: 'Quote sent to client via secure link',
      actor: authResult.userId,
      metadata: { shareLinkId: link.id },
    })

    emitWorkflowAuditEvent({
      event: 'quote_sent_to_client',
      quoteId: parsed.data.quoteId,
      orgId: ctx.orgId,
      userId: authResult.userId,
      metadata: { shareLinkId: link.id, fromStatus: current, toStatus: 'SENT_TO_CLIENT' },
    })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3007'
    return NextResponse.json({
      ok: true,
      shareLinkUrl: `${baseUrl}/quote/${rawToken}`,
      shareLinkId: link.id,
    })
  }))
}

'use server'

/**
 * ShopMoiCa — Send Quote Actions
 *
 * Server actions for sending quotes to clients, generating share links,
 * and managing the quote review/send workflow.
 */
import { z } from 'zod'
import { quoteRepo } from '@/lib/db'
import { resolveOrgContext } from '@/lib/resolve-org'
import { attemptQuoteTransition } from '@/lib/workflows/quote-state-machine'
import { createShareLink, findShareLinksForQuote } from '@/lib/services/share-link-service'
import { emitWorkflowAuditEvent } from '@/lib/services/workflow-audit-service'
import { recordTimelineEvent } from '@/lib/repositories/workflow-repository'
import { SHOPMOICA_SETTINGS } from '@nzila/platform-commerce-org/defaults'
import type { ActionResult } from '@/lib/actions'

// ── Submit for Internal Review ─────────────────────────────────────────────

export async function submitForReviewAction(
  quoteId: string,
): Promise<ActionResult<{ status: string }>> {
  try {
    const ctx = await resolveOrgContext()
    const quote = await quoteRepo.findById(quoteId)
    if (!quote) return { ok: false, error: 'Quote not found' }

    const current = quote.status.toUpperCase()
    const transition = attemptQuoteTransition(
      current as 'DRAFT',
      'INTERNAL_REVIEW',
    )
    if (!transition.ok) {
      return { ok: false, error: transition.reason }
    }

    await quoteRepo.update(quoteId, { status: 'INTERNAL_REVIEW' })

    await recordTimelineEvent({
      quoteId,
      event: 'internal_review',
      description: 'Quote submitted for internal review',
      actor: ctx.actorId,
    })

    return { ok: true, data: { status: 'INTERNAL_REVIEW' } }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to submit for review'
    return { ok: false, error: message }
  }
}

// ── Send Quote to Client ───────────────────────────────────────────────────

const SendQuoteInput = z.object({
  quoteId: z.string().uuid(),
  expiresInDays: z.number().int().min(1).max(90).default(SHOPMOICA_SETTINGS.shareLinkExpiryDays),
})

export async function sendQuoteToClientAction(
  input: z.infer<typeof SendQuoteInput>,
): Promise<ActionResult<{ shareLinkUrl: string; status: string }>> {
  try {
    const parsed = SendQuoteInput.parse(input)
    const ctx = await resolveOrgContext()
    const quote = await quoteRepo.findById(parsed.quoteId)
    if (!quote) return { ok: false, error: 'Quote not found' }

    const current = quote.status.toUpperCase()

    // Allow sending from INTERNAL_REVIEW or re-sending from REVISION_REQUESTED
    const transition = attemptQuoteTransition(
      current as 'INTERNAL_REVIEW',
      'SENT_TO_CLIENT',
    )
    if (!transition.ok) {
      return { ok: false, error: transition.reason }
    }

    // Generate share link
    const { link, rawToken } = await createShareLink(
      {
        quoteId: parsed.quoteId,
        expiresInDays: parsed.expiresInDays,
        createdBy: ctx.actorId,
      },
      ctx.orgId,
    )

    // Update quote status
    await quoteRepo.update(parsed.quoteId, { status: 'SENT_TO_CLIENT' })

    // Record timeline
    await recordTimelineEvent({
      quoteId: parsed.quoteId,
      event: 'sent_to_client',
      description: 'Quote sent to client via secure link',
      actor: ctx.actorId,
      metadata: { shareLinkId: link.id },
    })

    // Audit
    emitWorkflowAuditEvent({
      event: 'quote_sent_to_client',
      quoteId: parsed.quoteId,
      orgId: ctx.orgId,
      userId: ctx.actorId,
      metadata: {
        shareLinkId: link.id,
        fromStatus: current,
        toStatus: 'SENT_TO_CLIENT',
      },
    })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3007'
    const shareLinkUrl = `${baseUrl}/quote/${rawToken}`

    return { ok: true, data: { shareLinkUrl, status: 'SENT_TO_CLIENT' } }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send quote'
    return { ok: false, error: message }
  }
}

// ── Get Share Links for a Quote ────────────────────────────────────────────

export async function getQuoteShareLinksAction(
  quoteId: string,
): Promise<ActionResult<{ links: Awaited<ReturnType<typeof findShareLinksForQuote>> }>> {
  const links = await findShareLinksForQuote(quoteId)
  return { ok: true, data: { links } }
}

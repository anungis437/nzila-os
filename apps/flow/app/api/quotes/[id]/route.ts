import { NextResponse } from 'next/server'
import { authenticateUser, withRequestContext } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { quoteRepo } from '@/lib/db'
import { auditQuoteTransition } from '@/lib/evidence'
import { logTransition } from '@/lib/commerce-telemetry'
import { logger } from '@/lib/logger'
import { resolveOrgContext } from '@/lib/resolve-org'
import { executeCommand } from '@/lib/control/control-adapter'

/**
 * GET /api/quotes/[id] — fetch a single quote.
 * PATCH /api/quotes/[id] — update a quote (status with governed transition, fields).
 */

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withRequestContext(request, () =>
    withSpan('api.quotes.get', { 'http.method': 'GET' }, async () => {
    const authResult = await authenticateUser()
    if (!authResult.ok) return authResult.response
    const { id } = await params
    try {
      const ctx = await resolveOrgContext()
      const quote = await quoteRepo.findById(id)
      if (!quote) {
        return NextResponse.json(
          { ok: false, error: 'Quote not found' },
          { status: 404 },
        )
      }
      if (quote.orgId !== ctx.orgId) {
        return NextResponse.json(
          { ok: false, error: 'Quote not found' },
          { status: 404 },
        )
      }
      return NextResponse.json({ ok: true, data: quote })
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
        { status: 500 },
      )
    }
    }),
  )
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withRequestContext(request, () =>
    withSpan('api.quotes.update', { 'http.method': 'PATCH' }, async () => {
    const authResult = await authenticateUser()
    if (!authResult.ok) return authResult.response
    const { userId } = authResult
    const ctx = await resolveOrgContext()
    const orgId = ctx.orgId
    const { id } = await params
    try {
      const body = await request.json()

    // ── Status updates are command-driven only ───────────────────────
    if (body.status) {
      const existing = await quoteRepo.findById(id)
      if (!existing) {
        return NextResponse.json(
          { ok: false, error: 'Quote not found' },
          { status: 404 },
        )
      }

      const status = String(body.status).toUpperCase()
      let commandResult: Awaited<ReturnType<typeof executeCommand>> | null = null

      if (status === 'INTERNAL_REVIEW') {
        commandResult = await executeCommand({ type: 'submit_for_review', quote_id: id, actor_id: userId })
      } else if (status === 'SENT_TO_CLIENT') {
        commandResult = await executeCommand({ type: 'send_quote', quote_id: id, actor_id: userId })
      } else if (status === 'ACCEPTED') {
        commandResult = await executeCommand({
          type: 'accept_quote',
          quote_id: id,
          actor_id: userId,
          customer_name: typeof body.customerName === 'string' ? body.customerName : undefined,
          customer_email: typeof body.customerEmail === 'string' ? body.customerEmail : undefined,
          message: typeof body.message === 'string' ? body.message : undefined,
        })
      } else if (status === 'REVISION_REQUESTED') {
        if (typeof body.requestMessage !== 'string' || body.requestMessage.trim().length === 0) {
          return NextResponse.json(
            { ok: false, error: 'requestMessage is required for REVISION_REQUESTED transition' },
            { status: 400 },
          )
        }
        commandResult = await executeCommand({
          type: 'request_quote_revision',
          quote_id: id,
          actor_id: userId,
          request_message: body.requestMessage,
        })
      } else {
        return NextResponse.json(
          { ok: false, error: `Direct status mutation to ${status} is not allowed. Use command handlers.` },
          { status: 400 },
        )
      }

      if (!commandResult?.ok) {
        return NextResponse.json(
          { ok: false, error: commandResult?.error ?? 'Failed to process quote status transition' },
          { status: 422 },
        )
      }

      const quote = await quoteRepo.findById(id)

      // Audit + telemetry (non-blocking)
      try {
        auditQuoteTransition({
          quoteId: id,
          fromStatus: existing.status,
          toStatus: status,
          userId,
          orgId,
        })
        logTransition(
          { orgId },
          'quote',
          existing.status,
          status,
          true,
        )
      } catch (auditErr) {
        logger.warn('Audit/telemetry failed for quote transition', {
          quoteId: id,
          error: auditErr instanceof Error ? auditErr.message : String(auditErr),
        })
      }

      return NextResponse.json({ ok: true, data: quote })
    }

    // ── Non-status field update (no machine required) ───────────────
    const quote = await quoteRepo.update(id, body)
    return NextResponse.json({ ok: true, data: quote })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
    }),
  )
}

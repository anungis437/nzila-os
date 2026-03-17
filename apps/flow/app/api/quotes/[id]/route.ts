import { NextResponse } from 'next/server'
import { authenticateUser, withRequestContext } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { quoteRepo } from '@/lib/db'
import { transitionQuote } from '@/lib/quote-machine'
import { auditQuoteTransition } from '@/lib/evidence'
import { logTransition } from '@/lib/commerce-telemetry'
import { logger } from '@/lib/logger'
import { resolveOrgContext } from '@/lib/resolve-org'

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

    // ── If status is being changed, enforce state machine ───────────
    if (body.status) {
      const existing = await quoteRepo.findById(id)
      if (!existing) {
        return NextResponse.json(
          { ok: false, error: 'Quote not found' },
          { status: 404 },
        )
      }

      const transition = transitionQuote(
        existing.status as Parameters<typeof transitionQuote>[0],
        body.status,
        { orgId, actorId: userId, role: 'admin' as Parameters<typeof transitionQuote>[2]['role'], meta: {} },
        id,
      )
      if (!transition.ok) {
        return NextResponse.json(
          { ok: false, error: `Invalid transition: ${transition.reason}` },
          { status: 422 },
        )
      }

      const quote = await quoteRepo.update(id, body)

      // Audit + telemetry (non-blocking)
      try {
        auditQuoteTransition({
          quoteId: id,
          fromStatus: existing.status,
          toStatus: body.status,
          userId,
          orgId,
        })
        logTransition(
          { orgId },
          'quote',
          existing.status,
          body.status,
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

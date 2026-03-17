import { NextResponse } from 'next/server'
import { authenticateUser, withRequestContext } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { quoteRepo } from '@/lib/db'
import { resolveOrgContext } from '@/lib/resolve-org'

/**
 * GET /api/quotes — list all quotes for the current org.
 * POST /api/quotes — create a new quote.
 */

export async function GET(request: Request) {
  return withRequestContext(request, () =>
    withSpan('api.quotes.list', { 'http.method': 'GET' }, async () => {
    const authResult = await authenticateUser()
    if (!authResult.ok) return authResult.response
    try {
      const ctx = await resolveOrgContext()
      const quotes = await quoteRepo.findAll(ctx.orgId)
      return NextResponse.json({ ok: true, data: quotes })
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
        { status: 500 },
      )
    }
    }),
  )
}

export async function POST(request: Request) {
  return withRequestContext(request, () =>
    withSpan('api.quotes.create', { 'http.method': 'POST' }, async () => {
    const authResult = await authenticateUser()
    if (!authResult.ok) return authResult.response
    try {
      const body = await request.json()

    // Minimal validation
    if (!body.title) {
      return NextResponse.json(
        { ok: false, error: 'title is required' },
        { status: 400 },
      )
    }

    const ctx = await resolveOrgContext()
    const quote = await quoteRepo.create({
      orgId: ctx.orgId,
      title: body.title,
      tier: body.tier ?? 'STANDARD',
      customerId: body.customerId ?? 'unknown',
      boxCount: body.boxCount ?? 1,
      theme: body.theme,
      notes: body.notes,
      lines: body.lines ?? [],
    })

    return NextResponse.json({ ok: true, data: quote }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
    }),
  )
}

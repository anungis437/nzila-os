import { NextResponse } from 'next/server'
import { authenticateUser, withRequestContext } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { resolveOrgContext } from '@/lib/resolve-org'
import { createQuote, listQuotes } from '@/lib/services/quote-service'

export async function GET(request: Request) {
  return withRequestContext(request, () =>
    withSpan('api.quotes.list', { 'http.method': 'GET' }, async () => {
      const authResult = await authenticateUser()
      if (!authResult.ok) return authResult.response
      try {
        const ctx = await resolveOrgContext()
        return NextResponse.json({ ok: true, data: await listQuotes(ctx) })
      } catch {
        return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 })
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
        if (!body.title) {
          return NextResponse.json({ ok: false, error: 'title is required' }, { status: 400 })
        }
        const ctx = await resolveOrgContext()
        const result = await createQuote(ctx, body)
        return NextResponse.json(result, { status: result.ok ? 201 : 422 })
      } catch (err) {
        return NextResponse.json(
          { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
          { status: 500 },
        )
      }
    }),
  )
}

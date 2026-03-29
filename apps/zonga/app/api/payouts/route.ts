/**
 * API — /api/payouts
 * GET  → list payouts (optional creatorId filter)
 * POST → execute a payout
 */
import { NextResponse } from 'next/server'
import { authenticateUser, withRequestContext } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { listPayouts, executePayout } from '@/lib/actions/payout-actions'

export async function GET(request: Request) {
  return withRequestContext(request, () =>
    withSpan('api.payouts.list', { 'http.method': 'GET' }, async () => {
      const auth = await authenticateUser()
      if (!auth.ok) return auth.response

      const url = new URL(request.url)
      const page = Number(url.searchParams.get('page') ?? '1')
      const creatorId = url.searchParams.get('creatorId') ?? undefined

      const data = await listPayouts({ page, creatorId })
      return NextResponse.json({ ok: true, data })
    }),
  )
}

export async function POST(request: Request) {
  return withRequestContext(request, () =>
    withSpan('api.payouts.execute', { 'http.method': 'POST' }, async () => {
      const auth = await authenticateUser()
      if (!auth.ok) return auth.response

      try {
        const body = await request.json()

        if (!body.creatorId || !body.amount) {
          return NextResponse.json(
            { ok: false, error: 'creatorId and amount are required' },
            { status: 400 },
          )
        }

        const result = await executePayout({
          creatorId: body.creatorId,
          amount: body.amount,
          currency: body.currency,
          payoutRail: body.payoutRail,
          creatorName: body.creatorName,
        })

        if (!result.success) {
          return NextResponse.json(
            { ok: false, error: 'Payout execution failed' },
            { status: 400 },
          )
        }

        return NextResponse.json({ ok: true, data: result }, { status: 201 })
      } catch (_err) {
        return NextResponse.json(
          { ok: false, error: 'Internal server error' },
          { status: 500 },
        )
      }
    }),
  )
}

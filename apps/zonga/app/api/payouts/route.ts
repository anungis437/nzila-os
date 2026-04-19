/**
 * API — /api/payouts
 * GET  → list payouts (optional creatorId filter)
 * POST → execute a payout
 *
 * Role enforcement: GET requires finance_admin or client_admin.
 *                   POST requires finance_admin only.
 */
import { NextResponse } from 'next/server'
import { withOrgScope, requireRole } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { listPayouts, executePayout } from '@/lib/actions/payout-actions'

export async function GET(request: Request) {
  return withOrgScope(request, async ({ orgId }) =>
    withSpan('api.payouts.list', { 'http.method': 'GET' }, async () => {
      const roleGuard = await requireRole(orgId, ['finance_admin', 'client_admin'])
      if (!roleGuard.ok) return roleGuard.response

      const url = new URL(request.url)
      const page = Number(url.searchParams.get('page') ?? '1')
      const creatorId = url.searchParams.get('creatorId') ?? undefined

      const data = await listPayouts({ page, creatorId })
      return NextResponse.json({ ok: true, data })
    }),
  )
}

export async function POST(request: Request) {
  return withOrgScope(request, async ({ orgId }) =>
    withSpan('api.payouts.execute', { 'http.method': 'POST' }, async () => {
      const roleGuard = await requireRole(orgId, ['finance_admin'])
      if (!roleGuard.ok) return roleGuard.response

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

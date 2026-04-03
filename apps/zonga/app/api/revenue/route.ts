/**
 * API — /api/revenue
 * GET  → revenue overview (totals, breakdowns, recent events)
 * POST → record a new revenue event
 */
import { NextResponse } from 'next/server'
import { withOrgScope } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { getRevenueOverview, recordRevenueEvent } from '@/lib/actions/revenue-actions'

export async function GET(request: Request) {
  return withOrgScope(request, () =>
    withSpan('api.revenue.overview', { 'http.method': 'GET' }, async () => {
      const data = await getRevenueOverview()
      return NextResponse.json({ ok: true, data })
    }),
  )
}

export async function POST(request: Request) {
  return withOrgScope(request, () =>
    withSpan('api.revenue.record', { 'http.method': 'POST' }, async () => {

      try {
        const body = await request.json()
        const result = await recordRevenueEvent(body)

        if (!result.success) {
          return NextResponse.json(
            { ok: false, error: result.error ?? 'Validation failed' },
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

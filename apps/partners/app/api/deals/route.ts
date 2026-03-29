/**
 * API — /api/deals
 * GET  → list deals with pagination + filters
 * POST → register a new deal
 */
import { NextResponse } from 'next/server'
import { authenticateUser, withRequestContext } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { z } from 'zod'
import { listDeals, getDealStats, createDeal } from '@/lib/actions/deal-actions'

const CreateDealSchema = z.object({
  accountName: z.string().min(1),
  contactName: z.string().min(1),
  contactEmail: z.string().email(),
  vertical: z.string().min(1),
  estimatedArr: z.number().positive(),
  expectedCloseDate: z.string().min(1),
  notes: z.string().optional(),
})

export async function GET(request: Request) {
  return withRequestContext(request, () =>
    withSpan('api.deals.list', { 'http.method': 'GET' }, async () => {
      const auth = await authenticateUser()
      if (!auth.ok) return auth.response

      const url = new URL(request.url)
      const view = url.searchParams.get('view')

      if (view === 'stats') {
        const data = await getDealStats()
        return NextResponse.json({ ok: true, data })
      }

      const page = Number(url.searchParams.get('page') ?? '1')
      const stage = url.searchParams.get('stage') ?? undefined
      const search = url.searchParams.get('search') ?? undefined

      const data = await listDeals({ page, stage, search })
      return NextResponse.json({ ok: true, data })
    }),
  )
}

export async function POST(request: Request) {
  return withRequestContext(request, () =>
    withSpan('api.deals.create', { 'http.method': 'POST' }, async () => {
      const auth = await authenticateUser()
      if (!auth.ok) return auth.response

      try {
        const body = await request.json()
        const parsed = CreateDealSchema.safeParse(body)
        if (!parsed.success) {
          return NextResponse.json(
            { ok: false, error: parsed.error.flatten().fieldErrors },
            { status: 400 },
          )
        }
        const result = await createDeal(parsed.data)

        if (!result.success) {
          return NextResponse.json(
            { ok: false, error: 'Deal creation failed' },
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

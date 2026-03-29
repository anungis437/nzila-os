/**
 * API — /api/commissions
 * GET  → list commissions or summary
 * POST → create a commission (on deal approval)
 */
import { NextResponse } from 'next/server'
import { authenticateUser, withRequestContext } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { z } from 'zod'
import {
  listCommissions,
  getCommissionSummary,
  createCommission,
} from '@/lib/actions/commission-actions'

const CreateCommissionSchema = z.object({
  dealId: z.string().min(1),
  accountName: z.string().min(1),
  partnerId: z.string().min(1),
  baseAmount: z.number().positive(),
  partnerTier: z.string().default('registered'),
})

export async function GET(request: Request) {
  return withRequestContext(request, () =>
    withSpan('api.commissions.list', { 'http.method': 'GET' }, async () => {
      const auth = await authenticateUser()
      if (!auth.ok) return auth.response

      const url = new URL(request.url)
      const view = url.searchParams.get('view')

      if (view === 'summary') {
        const tier = url.searchParams.get('tier') ?? undefined
        const data = await getCommissionSummary(tier)
        return NextResponse.json({ ok: true, data })
      }

      const page = Number(url.searchParams.get('page') ?? '1')
      const partnerId = url.searchParams.get('partnerId') ?? undefined

      const data = await listCommissions({ page, partnerId })
      return NextResponse.json({ ok: true, data })
    }),
  )
}

export async function POST(request: Request) {
  return withRequestContext(request, () =>
    withSpan('api.commissions.create', { 'http.method': 'POST' }, async () => {
      const auth = await authenticateUser()
      if (!auth.ok) return auth.response

      try {
        const body = await request.json()
        const parsed = CreateCommissionSchema.safeParse(body)
        if (!parsed.success) {
          return NextResponse.json(
            { ok: false, error: parsed.error.flatten().fieldErrors },
            { status: 400 },
          )
        }
        const result = await createCommission(parsed.data)

        if (!result.success) {
          return NextResponse.json(
            { ok: false, error: 'Commission creation failed' },
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

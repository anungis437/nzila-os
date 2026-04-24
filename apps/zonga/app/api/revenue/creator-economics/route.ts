import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withOrgScope } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { estimateCreatorEconomics } from '@/lib/creator-economics'

const querySchema = z.object({
  grossRevenueUsd: z.coerce.number().nonnegative(),
  platformFeePct: z.coerce.number().min(0).max(100).default(20),
  collaboratorRoyaltyPct: z.coerce.number().min(0).max(100).default(0),
  priorPayoutsUsd: z.coerce.number().nonnegative().default(0),
})

export async function GET(request: Request) {
  return withOrgScope(request, async () =>
    withSpan('api.revenue.creator_economics', { 'http.method': 'GET' }, async () => {
      const url = new URL(request.url)
      const parsed = querySchema.safeParse({
        grossRevenueUsd: url.searchParams.get('grossRevenueUsd'),
        platformFeePct: url.searchParams.get('platformFeePct') ?? 20,
        collaboratorRoyaltyPct: url.searchParams.get('collaboratorRoyaltyPct') ?? 0,
        priorPayoutsUsd: url.searchParams.get('priorPayoutsUsd') ?? 0,
      })

      if (!parsed.success) {
        return NextResponse.json({ ok: false, error: 'Invalid query parameters' }, { status: 400 })
      }

      const snapshot = estimateCreatorEconomics(parsed.data)
      return NextResponse.json({
        ok: true,
        eventName: 'zonga.creator_economics.previewed',
        data: snapshot,
      })
    }),
  )
}

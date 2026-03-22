/**
 * API — /api/ledger
 * GET  → ledger entries with pagination + filters
 * POST → trigger month-end reconciliation
 */
import { NextResponse } from 'next/server'
import { authenticateUser, withRequestContext } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { z } from 'zod'
import {
  getLedgerEntries,
  runReconciliation,
  getFinancialOverview,
} from '@/lib/actions/ledger-actions'

const LedgerQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  source: z.enum(['stripe', 'qbo', 'xero', 'sage', 'manual']).optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
})

export async function GET(request: Request) {
  return withRequestContext(request, () =>
    withSpan('api.ledger.list', { 'http.method': 'GET' }, async () => {
      const auth = await authenticateUser()
      if (!auth.ok) return auth.response

      const url = new URL(request.url)
      const view = url.searchParams.get('view')

      if (view === 'overview') {
        const data = await getFinancialOverview()
        return NextResponse.json({ ok: true, data })
      }

      const parsed = LedgerQuerySchema.safeParse({
        page: url.searchParams.get('page') ?? undefined,
        pageSize: url.searchParams.get('pageSize') ?? undefined,
        source: url.searchParams.get('source') ?? undefined,
        startDate: url.searchParams.get('startDate') ?? undefined,
        endDate: url.searchParams.get('endDate') ?? undefined,
      })

      if (!parsed.success) {
        return NextResponse.json(
          { ok: false, error: 'Invalid query parameters', details: parsed.error.flatten().fieldErrors },
          { status: 400 },
        )
      }

      const { page, pageSize, source, startDate, endDate } = parsed.data
      const data = await getLedgerEntries({ page, pageSize, source, startDate, endDate })
      return NextResponse.json({ ok: true, data })
    }),
  )
}

export async function POST(request: Request) {
  return withRequestContext(request, () =>
    withSpan('api.ledger.reconciliation', { 'http.method': 'POST' }, async () => {
      const auth = await authenticateUser()
      if (!auth.ok) return auth.response

      try {
        const result = await runReconciliation()
        return NextResponse.json({ ok: true, data: result })
      } catch (err) {
        return NextResponse.json(
          { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
          { status: 500 },
        )
      }
    }),
  )
}

/**
 * API — /api/integrations
 * GET  → integration statuses (Stripe, QBO, Tax)
 * POST → trigger sync for a provider
 */
import { NextResponse } from 'next/server'
import { authenticateUser, withRequestContext } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { z } from 'zod'
import {
  getIntegrationStatuses,
  triggerSync,
  getTaxDeadlines,
} from '@/lib/actions/integration-actions'

const SyncRequestSchema = z.object({
  provider: z.enum(['stripe', 'quickbooks', 'tax-engine']),
})

export async function GET(request: Request) {
  return withRequestContext(request, () =>
    withSpan('api.integrations.list', { 'http.method': 'GET' }, async () => {
      const auth = await authenticateUser()
      if (!auth.ok) return auth.response

      const url = new URL(request.url)
      const include = url.searchParams.get('include')

      if (include === 'deadlines') {
        const deadlines = await getTaxDeadlines()
        return NextResponse.json({ ok: true, data: deadlines })
      }

      const data = await getIntegrationStatuses()
      return NextResponse.json({ ok: true, data })
    }),
  )
}

export async function POST(request: Request) {
  return withRequestContext(request, () =>
    withSpan('api.integrations.sync', { 'http.method': 'POST' }, async () => {
      const auth = await authenticateUser()
      if (!auth.ok) return auth.response

      try {
        const body = await request.json()
        const parsed = SyncRequestSchema.safeParse(body)

        if (!parsed.success) {
          return NextResponse.json(
            { ok: false, error: 'Invalid provider. Must be stripe, quickbooks, or tax-engine' },
            { status: 400 },
          )
        }

        const result = await triggerSync(parsed.data.provider)
        return NextResponse.json({ ok: result.success, message: result.message })
      } catch (err) {
        return NextResponse.json(
          { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
          { status: 500 },
        )
      }
    }),
  )
}

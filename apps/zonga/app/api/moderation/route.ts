/**
 * API — /api/moderation
 * GET → list moderation cases (with optional filters)
 */
import { NextResponse } from 'next/server'
import { withOrgScope } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { listModerationCases, getModerationStats } from '@/lib/actions/moderation-actions'

export async function GET(request: Request) {
  return withOrgScope(request, () =>
    withSpan('api.moderation.list', { 'http.method': 'GET' }, async () => {

      const url = new URL(request.url)
      const status = url.searchParams.get('status') ?? undefined
      const severity = url.searchParams.get('severity') ?? undefined
      const entityType = url.searchParams.get('entityType') ?? undefined
      const includeStats = url.searchParams.get('stats') === 'true'

      const [cases, stats] = await Promise.all([
        listModerationCases({ status, severity, entityType }),
        includeStats ? getModerationStats() : Promise.resolve(null),
      ])

      return NextResponse.json({ ok: true, data: { cases, stats } })
    }),
  )
}

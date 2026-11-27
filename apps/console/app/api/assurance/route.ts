import { readExecutiveAssurance } from '@/lib/services/platform-assurance-service'
/**
 * API — Executive Assurance Dashboard
 * GET /api/assurance — compute KPI scores from real platform data
 *
 * Supports ?download=true for JSON file export.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformRole, withRequestContext } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { createLogger } from '@nzila/os-core'

const _logger = createLogger('api:assurance')

export async function GET(req: NextRequest) {
  return withRequestContext(req, () =>
    withSpan('api.assurance.dashboard', {}, async () => {
      const auth = await requirePlatformRole('platform_admin', 'studio_admin')
      if (!auth.ok) return auth.response

      const result = await readExecutiveAssurance()
      const generatedAt = result.generatedAt

      if (req.nextUrl.searchParams.get('download') === 'true') {
        return new NextResponse(JSON.stringify(result, null, 2), {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="assurance-dashboard-${generatedAt.slice(0, 10)}.json"`,
          },
        })
      }

      return NextResponse.json(result)
    }),
  )
}

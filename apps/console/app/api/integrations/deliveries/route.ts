import { NextRequest, NextResponse } from 'next/server'
import { withRequestContext, requireOrgAccess } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { listIntegrationDeliveries } from '@/lib/integrations-runtime-store'

export async function GET(req: NextRequest) {
  return withRequestContext(req, () =>
    withSpan('api.integrations.deliveries', {}, async () => {
      const orgId = req.nextUrl.searchParams.get('orgId')
      const provider = req.nextUrl.searchParams.get('provider')
      const status = req.nextUrl.searchParams.get('status')

      if (!orgId) {
        return NextResponse.json({
          entries: [],
          source: 'no_org',
          filters: { provider, status },
          note: 'orgId not supplied',
        })
      }

      const access = await requireOrgAccess(orgId)
      if (!access.ok) return access.response

      const entries = await listIntegrationDeliveries({ orgId, provider, status })

      return NextResponse.json({
        entries,
        source: 'live',
        filters: { provider, status },
      })
    }),
  )
}

import { NextRequest, NextResponse } from 'next/server'
import { withRequestContext, requireOrgAccess } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { listIntegrationDlqEntries } from '@/lib/integrations-runtime-store'

export async function GET(req: NextRequest) {
  return withRequestContext(req, () =>
    withSpan('api.integrations.dlq', {}, async () => {
      const orgId = req.nextUrl.searchParams.get('orgId')
      if (!orgId) {
        return NextResponse.json({
          entries: [],
          source: 'no_org',
          note: 'orgId not supplied',
        })
      }

      const access = await requireOrgAccess(orgId)
      if (!access.ok) return access.response

      const entries = await listIntegrationDlqEntries(orgId)

      return NextResponse.json({
        entries,
        source: 'live',
      })
    }),
  )
}

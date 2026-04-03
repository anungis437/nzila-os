/**
 * API — /api/rights
 * GET → list royalty splits, disputes, or sync licenses
 */
import { NextResponse } from 'next/server'
import { withOrgScope } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import {
  listSplitsForRelease,
  listRightsDisputes,
  listSyncLicenses,
} from '@/lib/actions/rights-actions'

export async function GET(request: Request) {
  return withOrgScope(request, () =>
    withSpan('api.rights.list', { 'http.method': 'GET' }, async () => {

      const url = new URL(request.url)
      const resource = url.searchParams.get('resource') ?? 'splits'
      const releaseId = url.searchParams.get('releaseId') ?? undefined

      if (resource === 'splits' && releaseId) {
        const splits = await listSplitsForRelease(releaseId)
        return NextResponse.json({ ok: true, data: { splits } })
      }

      if (resource === 'disputes') {
        const status = url.searchParams.get('status') ?? undefined
        const disputes = await listRightsDisputes({ releaseId, status })
        return NextResponse.json({ ok: true, data: { disputes } })
      }

      if (resource === 'licenses') {
        const assetId = url.searchParams.get('assetId') ?? undefined
        const status = url.searchParams.get('status') ?? undefined
        const licenses = await listSyncLicenses({ assetId, status })
        return NextResponse.json({ ok: true, data: { licenses } })
      }

      return NextResponse.json(
        { ok: false, error: 'Provide resource=splits&releaseId=..., resource=disputes, or resource=licenses' },
        { status: 400 },
      )
    }),
  )
}

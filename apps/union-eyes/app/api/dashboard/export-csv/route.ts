/**
 * Dashboard CSV export is intentionally unavailable until a real tenant-scoped data source,
 * institutionally approved export mandate, audit, bounded pagination and spreadsheet-formula
 * neutralisation are implemented. Never return a fabricated empty 200 CSV in any environment.
 *
 * DEF-0B6-CMP-EXPORT-CSV-AUTHENTICATION-ONLY-AND-EMPTY-200-OUTSIDE-PRODUCTION
 */
import { NextResponse } from 'next/server'
import { withApi } from '@/lib/api/framework'

export const dynamic = 'force-dynamic'

export const GET = withApi(
  { auth: { required: true, minRole: 'admin' } },
  async ({ organizationId }) => {
    if (!organizationId) {
      return NextResponse.json(
        { error: 'ORGANIZATION_CONTEXT_REQUIRED' },
        { status: 403, headers: { 'Cache-Control': 'private, no-store' } },
      )
    }

    return NextResponse.json(
      {
        error: 'DASHBOARD_CSV_EXPORT_NOT_IMPLEMENTED',
        message: 'CSV export is unavailable until tenant-scoped records, export authorization, audit and CSV safety controls are implemented and verified.',
      },
      { status: 501, headers: { 'Cache-Control': 'private, no-store' } },
    )
  },
)

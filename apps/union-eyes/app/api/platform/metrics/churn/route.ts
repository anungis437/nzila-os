/**
 * Customer churn is not yet backed by qualified platform financial reporting.
 * DEF-0B10-OPL-12: never substitute unrelated zero usage counters for churn.
 * The institutional platform-data mandate and source-of-truth reconciliation
 * must be approved before an actual metric is exposed.
 */
import { NextResponse } from 'next/server'
import { withApi } from '@/lib/api/framework'

export const dynamic = 'force-dynamic'

export const GET = withApi(
  {
    auth: { required: true, minRole: 'system_admin' },
    openapi: {
      tags: ['System'],
      summary: 'Customer churn (unavailable pending verified financial data)',
      description: 'Explicitly unavailable until platform financial source data and authorization are verified.',
    },
  },
  async () => NextResponse.json(
    {
      error: 'PLATFORM_CHURN_NOT_IMPLEMENTED',
      capability: 'platform.metrics.churn',
      capabilityState: 'NOT_IMPLEMENTED',
      message: 'Verified financial source data and platform reporting authority are not available.',
    },
    { status: 501, headers: { 'Cache-Control': 'private, no-store' } },
  ),
)

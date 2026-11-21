import { listStripeDailyScores } from '@/lib/services/ml-read-service'
// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * GET /api/ml/scores/stripe/daily
 *
 * Returns Stripe daily anomaly scores for a date range.
 *
 * RBAC:
 *   - View scores: unknown active entity member
 *   - includeFeatures=true: org_admin only
 *
 * Query params:
 *   orgId        required
 *   startDate       required (YYYY-MM-DD)
 *   endDate         required (YYYY-MM-DD)
 *   modelKey        optional — filters to scores from a specific model key
 *   includeFeatures optional boolean (default false)
 */
import { NextRequest, NextResponse } from 'next/server'

import { requireOrgAccess } from '@/lib/api-guards'
import { createLogger } from '@nzila/os-core'

const logger = createLogger('ml:scores:stripe:daily')

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const orgId = searchParams.get('orgId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const modelKey = searchParams.get('modelKey')
    const includeFeatures = searchParams.get('includeFeatures') === 'true'

    if (!orgId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'orgId, startDate, and endDate are required' },
        { status: 400 },
      )
    }

    const access = await requireOrgAccess(orgId)
    if (!access.ok) return access.response

    // featuresJson only allowed for org_admin
    if (includeFeatures && access.context.membership?.role !== 'org_admin') {
      return NextResponse.json(
        { error: 'Forbidden: includeFeatures requires org_admin role' },
        { status: 403 },
      )
    }

    const result = await listStripeDailyScores({
      orgId,
      startDate,
      endDate,
      modelKey,
      includeFeatures,
    })
    return NextResponse.json(result.body, { status: result.status })
  } catch (err) {
    logger.error('[ML /scores/stripe/daily]', err instanceof Error ? err : { detail: err })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

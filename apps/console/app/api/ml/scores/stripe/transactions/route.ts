import { listStripeTransactionScores } from '@/lib/services/ml-read-service'
// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * GET /api/ml/scores/stripe/transactions
 *
 * Returns Stripe transaction anomaly scores (Option B).
 * Paginated via cursor (createdAt-based).
 *
 * RBAC:
 *   - View scores: unknown active entity member
 *   - includeFeatures=true: org_admin only
 *
 * Query params:
 *   orgId        required
 *   startDate       required (YYYY-MM-DD)
 *   endDate         required (YYYY-MM-DD)
 *   isAnomaly       optional boolean — filter to anomalies only
 *   minScore        optional number — filter to scores below this threshold
 *   limit           optional — default 100, max 500
 *   cursor          optional — ISO timestamp of last item (for pagination)
 *   includeFeatures optional boolean (default false; org_admin only)
 */
import { NextRequest, NextResponse } from 'next/server'

import { requireOrgAccess } from '@/lib/api-guards'
import { createLogger } from '@nzila/os-core'

const logger = createLogger('ml:scores:stripe:transactions')

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const orgId = searchParams.get('orgId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const isAnomalyParam = searchParams.get('isAnomaly')
    const minScore = searchParams.get('minScore')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 500)
    const cursor = searchParams.get('cursor')
    const includeFeatures = searchParams.get('includeFeatures') === 'true'

    if (!orgId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'orgId, startDate, and endDate are required' },
        { status: 400 },
      )
    }

    const access = await requireOrgAccess(orgId)
    if (!access.ok) return access.response

    if (includeFeatures && access.context.membership?.role !== 'org_admin') {
      return NextResponse.json(
        { error: 'Forbidden: includeFeatures requires org_admin role' },
        { status: 403 },
      )
    }

    const result = await listStripeTransactionScores({
      orgId,
      startDate,
      endDate,
      isAnomalyParam,
      minScore,
      limit,
      cursor,
      includeFeatures,
    })
    return NextResponse.json(result.body, { status: result.status })
  } catch (err) {
    logger.error('[ML /scores/stripe/transactions]', err instanceof Error ? err : { detail: err })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

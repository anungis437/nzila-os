import { listUeSlaRiskScores } from '@/lib/services/ml-read-service'
// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * GET /api/ml/scores/ue/cases/sla-risk
 *
 * Returns UnionEyes case SLA breach risk scores for a date range.
 * Cursor-paginated; sorted by (occurredAt DESC, id DESC).
 * Cursor is base64("<iso-timestamp>|<uuid>") — composite key prevents
 * duplicate/skipped rows when multiple records share the same timestamp.
 *
 * RBAC:
 *   - View scores: unknown active entity member
 *   - includeFeatures=true: org_admin only
 *
 * Query params:
 *   orgId        required
 *   startDate       required (YYYY-MM-DD)
 *   endDate         required (YYYY-MM-DD)
 *   breach          optional — "true" | "false" to filter by predictedBreach
 *   minProb         optional — minimum probability (0..1) to filter results
 *   limit           optional — max rows (default 100, max 500)
 *   cursor          optional — base64-encoded cursor (probability:id) for pagination
 *   includeFeatures optional boolean (default false)
 *
 * Response:
 *   { items: UESlaRiskScoreResponse[], nextCursor: string | null, total: number }
 */
import { NextRequest, NextResponse } from 'next/server'

import { requireOrgAccess } from '@/lib/api-guards'
import { createLogger } from '@nzila/os-core'

const logger = createLogger('ml:scores:ue:cases:sla-risk')

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 500

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const orgId = searchParams.get('orgId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const breachParam = searchParams.get('breach')
    const minProbParam = searchParams.get('minProb')
    const includeFeatures = searchParams.get('includeFeatures') === 'true'
    const cursor = searchParams.get('cursor')
    const rawLimit = searchParams.get('limit')
    const limit = Math.min(Number(rawLimit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT, MAX_LIMIT)

    if (!orgId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'orgId, startDate, and endDate are required' },
        { status: 400 },
      )
    }

    const access = await requireOrgAccess(orgId)
    if (!access.ok) return access.response

    // featuresJson only for org_admin
    if (includeFeatures && access.context.membership?.role !== 'org_admin') {
      return NextResponse.json(
        { error: 'Forbidden: includeFeatures requires org_admin role' },
        { status: 403 },
      )
    }

    const result = await listUeSlaRiskScores({
      orgId,
      startDate,
      endDate,
      breachParam,
      minProbParam,
      includeFeatures,
      cursor,
      limit,
    })
    return NextResponse.json(result.body, { status: result.status })
  } catch (err) {
    logger.error('[ML /scores/ue/cases/sla-risk]', err instanceof Error ? err : { detail: err })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { listUePriorityScores } from '@/lib/services/ml-read-service'
// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * GET /api/ml/scores/ue/cases/priority
 *
 * Returns UnionEyes case priority predictions for a date range.
 * Cursor-paginated; sorted newest-first by (occurredAt DESC, id DESC).
 * Cursor is base64("<iso-timestamp>|<uuid>") — composite key prevents
 * duplicate/skipped rows when multiple records share the same occurredAt.
 *
 * RBAC:
 *   - View scores: union_admin, union_staff, org_admin (any active entity member)
 *   - includeFeatures=true: org_admin only (no features for viewers/auditors)
 *
 * Query params:
 *   orgId        required
 *   startDate       required (YYYY-MM-DD)
 *   endDate         required (YYYY-MM-DD)
 *   priority        optional — filter by predictedPriority value
 *   limit           optional — max rows (default 100, max 500)
 *   cursor          optional — base64-encoded last id for pagination
 *   includeFeatures optional boolean (default false)
 *
 * Response:
 *   { items: UEPriorityScoreResponse[], nextCursor: string | null, total: number }
 */
import { NextRequest, NextResponse } from 'next/server'

import { requireOrgAccess } from '@/lib/api-guards'
import { createLogger } from '@nzila/os-core'

const logger = createLogger('ml:scores:ue:cases:priority')

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
    const priorityFilter = searchParams.get('priority')
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

    const result = await listUePriorityScores({
      orgId,
      startDate,
      endDate,
      priorityFilter,
      includeFeatures,
      cursor,
      limit,
    })
    return NextResponse.json(result.body, { status: result.status })
  } catch (err) {
    logger.error('[ML /scores/ue/cases/priority]', err instanceof Error ? err : { detail: err })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

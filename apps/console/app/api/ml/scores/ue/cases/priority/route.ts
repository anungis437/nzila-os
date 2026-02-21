// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * GET /api/ml/scores/ue/cases/priority
 *
 * Returns Union Eyes case priority predictions for a date range.
 * Cursor-paginated; sorted newest-first by (occurredAt DESC, id DESC).
 * Cursor is base64("<iso-timestamp>|<uuid>") — composite key prevents
 * duplicate/skipped rows when multiple records share the same occurredAt.
 *
 * RBAC:
 *   - View scores: union_admin, union_staff, entity_admin (any active entity member)
 *   - includeFeatures=true: entity_admin only (no features for viewers/auditors)
 *
 * Query params:
 *   entityId        required
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
import { db } from '@nzila/db'
import { mlScoresUECasesPriority, mlModels } from '@nzila/db/schema'
import { eq, and, gte, lte, lt, desc, or } from 'drizzle-orm'
import { requireEntityAccess } from '@/lib/api-guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 500

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const entityId = searchParams.get('entityId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const priorityFilter = searchParams.get('priority')
    const includeFeatures = searchParams.get('includeFeatures') === 'true'
    const cursor = searchParams.get('cursor')
    const rawLimit = searchParams.get('limit')
    const limit = Math.min(Number(rawLimit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT, MAX_LIMIT)

    if (!entityId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'entityId, startDate, and endDate are required' },
        { status: 400 },
      )
    }

    const access = await requireEntityAccess(entityId)
    if (!access.ok) return access.response

    // featuresJson only for entity_admin
    if (includeFeatures && access.context.membership?.role !== 'entity_admin') {
      return NextResponse.json(
        { error: 'Forbidden: includeFeatures requires entity_admin role' },
        { status: 403 },
      )
    }

    const startTs = new Date(startDate + 'T00:00:00Z')
    const endTs = new Date(endDate + 'T23:59:59Z')

    // Decode composite cursor: base64("<iso-timestamp>|<uuid>")
    // Composite key prevents duplicate/skipped rows when rows share a timestamp.
    let cursorTs: Date | null = null
    let cursorId: string | null = null
    if (cursor) {
      try {
        const decoded = Buffer.from(cursor, 'base64').toString('utf-8')
        const pipeIdx = decoded.lastIndexOf('|')
        if (pipeIdx === -1) throw new Error('malformed')
        cursorTs = new Date(decoded.slice(0, pipeIdx))
        cursorId = decoded.slice(pipeIdx + 1)
        if (isNaN(cursorTs.getTime()) || !cursorId) throw new Error('invalid')
      } catch {
        return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 })
      }
    }

    const whereClause = and(
      eq(mlScoresUECasesPriority.entityId, entityId),
      gte(mlScoresUECasesPriority.occurredAt, startTs),
      lte(mlScoresUECasesPriority.occurredAt, endTs),
      ...(priorityFilter ? [eq(mlScoresUECasesPriority.predictedPriority, priorityFilter)] : []),
      ...(cursorTs && cursorId
        ? [or(
            lt(mlScoresUECasesPriority.occurredAt, cursorTs),
            and(
              eq(mlScoresUECasesPriority.occurredAt, cursorTs),
              lt(mlScoresUECasesPriority.id, cursorId),
            ),
          )]
        : []),
    )

    const rows = await db
      .select({
        id: mlScoresUECasesPriority.id,
        caseId: mlScoresUECasesPriority.caseId,
        occurredAt: mlScoresUECasesPriority.occurredAt,
        score: mlScoresUECasesPriority.score,
        predictedPriority: mlScoresUECasesPriority.predictedPriority,
        actualPriority: mlScoresUECasesPriority.actualPriority,
        modelId: mlScoresUECasesPriority.modelId,
        modelKey: mlModels.modelKey,
        inferenceRunId: mlScoresUECasesPriority.inferenceRunId,
        createdAt: mlScoresUECasesPriority.createdAt,
        featuresJson: mlScoresUECasesPriority.featuresJson,
      })
      .from(mlScoresUECasesPriority)
      .innerJoin(mlModels, eq(mlScoresUECasesPriority.modelId, mlModels.id))
      .where(whereClause)
      .orderBy(desc(mlScoresUECasesPriority.occurredAt), desc(mlScoresUECasesPriority.id))
      .limit(limit + 1)  // fetch one extra to detect next page

    const hasMore = rows.length > limit
    const pageRows = rows.slice(0, limit)

    const nextCursor = hasMore
      ? Buffer.from(
          `${pageRows[pageRows.length - 1].occurredAt.toISOString()}|${pageRows[pageRows.length - 1].id}`,
        ).toString('base64')
      : null

    return NextResponse.json({
      items: pageRows.map((r) => ({
        id: r.id,
        caseId: r.caseId,
        occurredAt: r.occurredAt.toISOString(),
        score: r.score,
        predictedPriority: r.predictedPriority,
        actualPriority: r.actualPriority,
        modelId: r.modelId,
        modelKey: r.modelKey,
        inferenceRunId: r.inferenceRunId,
        createdAt: r.createdAt.toISOString(),
        ...(includeFeatures ? { features: r.featuresJson } : {}),
      })),
      nextCursor,
      total: pageRows.length,
    })
  } catch (err) {
    console.error('[ML /scores/ue/cases/priority]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

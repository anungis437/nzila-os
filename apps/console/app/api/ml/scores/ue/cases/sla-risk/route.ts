/**
 * GET /api/ml/scores/ue/cases/sla-risk
 *
 * Returns Union Eyes case SLA breach risk scores for a date range.
 * Cursor-paginated; sorted by (occurredAt DESC, id DESC).
 * Cursor is base64("<iso-timestamp>|<uuid>") — composite key prevents
 * duplicate/skipped rows when multiple records share the same timestamp.
 *
 * RBAC:
 *   - View scores: any active entity member
 *   - includeFeatures=true: entity_admin only
 *
 * Query params:
 *   entityId        required
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
import { db } from '@nzila/db'
import { mlScoresUESlaRisk, mlModels } from '@nzila/db/schema'
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
    const breachParam = searchParams.get('breach')
    const minProbParam = searchParams.get('minProb')
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
    const minProb = minProbParam ? parseFloat(minProbParam) : null

    // Optional breach filter
    let breachFilter: boolean | null = null
    if (breachParam === 'true') breachFilter = true
    if (breachParam === 'false') breachFilter = false

    // Decode composite cursor: base64("<iso-timestamp>|<uuid>")
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
      eq(mlScoresUESlaRisk.entityId, entityId),
      gte(mlScoresUESlaRisk.occurredAt, startTs),
      lte(mlScoresUESlaRisk.occurredAt, endTs),
      ...(breachFilter !== null ? [eq(mlScoresUESlaRisk.predictedBreach, breachFilter)] : []),
      ...(cursorTs && cursorId
        ? [or(
            lt(mlScoresUESlaRisk.occurredAt, cursorTs),
            and(
              eq(mlScoresUESlaRisk.occurredAt, cursorTs),
              lt(mlScoresUESlaRisk.id, cursorId),
            ),
          )]
        : []),
    )

    let rows = await db
      .select({
        id: mlScoresUESlaRisk.id,
        caseId: mlScoresUESlaRisk.caseId,
        occurredAt: mlScoresUESlaRisk.occurredAt,
        probability: mlScoresUESlaRisk.probability,
        predictedBreach: mlScoresUESlaRisk.predictedBreach,
        actualBreach: mlScoresUESlaRisk.actualBreach,
        modelId: mlScoresUESlaRisk.modelId,
        modelKey: mlModels.modelKey,
        inferenceRunId: mlScoresUESlaRisk.inferenceRunId,
        createdAt: mlScoresUESlaRisk.createdAt,
        featuresJson: mlScoresUESlaRisk.featuresJson,
      })
      .from(mlScoresUESlaRisk)
      .innerJoin(mlModels, eq(mlScoresUESlaRisk.modelId, mlModels.id))
      .where(whereClause)
      .orderBy(desc(mlScoresUESlaRisk.occurredAt), desc(mlScoresUESlaRisk.id))
      .limit(limit + 1)

    // Apply minProb filter in application layer (numeric comparison on string column)
    if (minProb !== null) {
      rows = rows.filter((r) => parseFloat(r.probability ?? '0') >= minProb)
    }

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
        probability: r.probability,
        predictedBreach: r.predictedBreach,
        actualBreach: r.actualBreach,
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
    console.error('[ML /scores/ue/cases/sla-risk]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

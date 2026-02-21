// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * GET /api/ml/scores/stripe/daily
 *
 * Returns Stripe daily anomaly scores for a date range.
 *
 * RBAC:
 *   - View scores: any active entity member
 *   - includeFeatures=true: entity_admin only
 *
 * Query params:
 *   entityId        required
 *   startDate       required (YYYY-MM-DD)
 *   endDate         required (YYYY-MM-DD)
 *   modelKey        optional — filters to scores from a specific model key
 *   includeFeatures optional boolean (default false)
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@nzila/db'
import { mlScoresStripeDaily, mlModels } from '@nzila/db/schema'
import { eq, and, gte, lte } from 'drizzle-orm'
import { requireEntityAccess } from '@/lib/api-guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const entityId = searchParams.get('entityId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const modelKey = searchParams.get('modelKey')
    const includeFeatures = searchParams.get('includeFeatures') === 'true'

    if (!entityId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'entityId, startDate, and endDate are required' },
        { status: 400 },
      )
    }

    const access = await requireEntityAccess(entityId)
    if (!access.ok) return access.response

    // featuresJson only allowed for entity_admin
    if (includeFeatures && access.context.membership?.role !== 'entity_admin') {
      return NextResponse.json(
        { error: 'Forbidden: includeFeatures requires entity_admin role' },
        { status: 403 },
      )
    }

    // If modelKey is passed, resolve modelId(s) for that key
    let modelIds: string[] | null = null
    if (modelKey) {
      const models = await db
        .select({ id: mlModels.id })
        .from(mlModels)
        .where(and(eq(mlModels.entityId, entityId), eq(mlModels.modelKey, modelKey)))
      modelIds = models.map((m) => m.id)
      if (modelIds.length === 0) {
        return NextResponse.json([], { status: 200 })
      }
    }

    const rows = await db
      .select({
        id: mlScoresStripeDaily.id,
        date: mlScoresStripeDaily.date,
        score: mlScoresStripeDaily.score,
        isAnomaly: mlScoresStripeDaily.isAnomaly,
        threshold: mlScoresStripeDaily.threshold,
        modelId: mlScoresStripeDaily.modelId,
        modelKey: mlModels.modelKey,
        inferenceRunId: mlScoresStripeDaily.inferenceRunId,
        featuresJson: mlScoresStripeDaily.featuresJson,
      })
      .from(mlScoresStripeDaily)
      .innerJoin(mlModels, eq(mlScoresStripeDaily.modelId, mlModels.id))
      .where(
        and(
          eq(mlScoresStripeDaily.entityId, entityId),
          gte(mlScoresStripeDaily.date, startDate),
          lte(mlScoresStripeDaily.date, endDate),
        ),
      )
      .orderBy(mlScoresStripeDaily.date)

    const filtered = modelIds
      ? rows.filter((r) => modelIds!.includes(r.modelId))
      : rows

    return NextResponse.json(
      filtered.map((r) => ({
        id: r.id,
        date: r.date,
        score: r.score,
        isAnomaly: r.isAnomaly,
        threshold: r.threshold,
        modelId: r.modelId,
        modelKey: r.modelKey,
        inferenceRunId: r.inferenceRunId,
        ...(includeFeatures ? { features: r.featuresJson } : {}),
      })),
    )
  } catch (err) {
    console.error('[ML /scores/stripe/daily]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

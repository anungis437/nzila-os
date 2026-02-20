/**
 * GET /api/ml/scores/stripe/transactions
 *
 * Returns Stripe transaction anomaly scores (Option B).
 * Paginated via cursor (createdAt-based).
 *
 * RBAC:
 *   - View scores: any active entity member
 *   - includeFeatures=true: entity_admin only
 *
 * Query params:
 *   entityId        required
 *   startDate       required (YYYY-MM-DD)
 *   endDate         required (YYYY-MM-DD)
 *   isAnomaly       optional boolean — filter to anomalies only
 *   minScore        optional number — filter to scores below this threshold
 *   limit           optional — default 100, max 500
 *   cursor          optional — ISO timestamp of last item (for pagination)
 *   includeFeatures optional boolean (default false; entity_admin only)
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@nzila/db'
import { mlScoresStripeTxn } from '@nzila/db/schema'
import { eq, and, gte, lte, lt } from 'drizzle-orm'
import { requireEntityAccess } from '@/lib/api-guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const entityId = searchParams.get('entityId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const isAnomalyParam = searchParams.get('isAnomaly')
    const minScore = searchParams.get('minScore')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 500)
    const cursor = searchParams.get('cursor')
    const includeFeatures = searchParams.get('includeFeatures') === 'true'

    if (!entityId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'entityId, startDate, and endDate are required' },
        { status: 400 },
      )
    }

    const access = await requireEntityAccess(entityId)
    if (!access.ok) return access.response

    if (includeFeatures && access.context.membership?.role !== 'entity_admin') {
      return NextResponse.json(
        { error: 'Forbidden: includeFeatures requires entity_admin role' },
        { status: 403 },
      )
    }

    const startTs = new Date(startDate + 'T00:00:00Z')
    const endTs = new Date(endDate + 'T23:59:59Z')
    const cursorTs = cursor ? new Date(cursor) : null

    const conditions = [
      eq(mlScoresStripeTxn.entityId, entityId),
      gte(mlScoresStripeTxn.occurredAt, startTs),
      lte(mlScoresStripeTxn.occurredAt, endTs),
      ...(isAnomalyParam !== null
        ? [eq(mlScoresStripeTxn.isAnomaly, isAnomalyParam === 'true')]
        : []),
      ...(cursorTs ? [lt(mlScoresStripeTxn.occurredAt, cursorTs)] : []),
    ]

    const rows = await db
      .select()
      .from(mlScoresStripeTxn)
      .where(and(...conditions))
      .orderBy(mlScoresStripeTxn.occurredAt)
      .limit(limit + 1) // fetch one extra to determine nextCursor

    const hasMore = rows.length > limit
    const items = hasMore ? rows.slice(0, limit) : rows
    const nextCursor = hasMore ? items[items.length - 1].occurredAt.toISOString() : null

    // Apply minScore filter post-query (score is numeric string from DB)
    const filtered = minScore
      ? items.filter((r) => parseFloat(String(r.score)) <= parseFloat(minScore))
      : items

    return NextResponse.json({
      items: filtered.map((r) => ({
        id: r.id,
        occurredAt: r.occurredAt.toISOString(),
        amount: r.amount,
        currency: r.currency,
        score: r.score,
        isAnomaly: r.isAnomaly,
        threshold: r.threshold,
        modelId: r.modelId,
        inferenceRunId: r.inferenceRunId,
        stripePaymentIntentId: r.stripePaymentIntentId,
        stripeChargeId: r.stripeChargeId,
        ...(includeFeatures ? { features: r.featuresJson } : {}),
      })),
      nextCursor,
    })
  } catch (err) {
    console.error('[ML /scores/stripe/transactions]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

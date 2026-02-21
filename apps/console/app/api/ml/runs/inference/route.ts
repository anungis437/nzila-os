// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * GET /api/ml/runs/inference
 *
 * Returns recent inference runs for an entity.
 * RBAC: any active entity member.
 *
 * Query params:
 *   entityId    required
 *   modelId     optional — filter to a specific model
 *   limit       optional — default 20, max 100
 */
import { NextRequest, NextResponse } from 'next/server'
import { platformDb } from '@nzila/db/platform'
import { mlInferenceRuns, mlModels } from '@nzila/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { requireEntityAccess } from '@/lib/api-guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const entityId = searchParams.get('entityId')
    const modelId = searchParams.get('modelId')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100)

    if (!entityId) {
      return NextResponse.json({ error: 'entityId is required' }, { status: 400 })
    }

    const access = await requireEntityAccess(entityId)
    if (!access.ok) return access.response

    const rows = await platformDb
      .select({
        id: mlInferenceRuns.id,
        entityId: mlInferenceRuns.entityId,
        modelId: mlInferenceRuns.modelId,
        modelKey: mlModels.modelKey,
        status: mlInferenceRuns.status,
        startedAt: mlInferenceRuns.startedAt,
        finishedAt: mlInferenceRuns.finishedAt,
        inputPeriodStart: mlInferenceRuns.inputPeriodStart,
        inputPeriodEnd: mlInferenceRuns.inputPeriodEnd,
        summaryJson: mlInferenceRuns.summaryJson,
        error: mlInferenceRuns.error,
        createdAt: mlInferenceRuns.createdAt,
      })
      .from(mlInferenceRuns)
      .innerJoin(mlModels, eq(mlInferenceRuns.modelId, mlModels.id))
      .where(
        and(
          eq(mlInferenceRuns.entityId, entityId),
          ...(modelId ? [eq(mlInferenceRuns.modelId, modelId)] : []),
        ),
      )
      .orderBy(desc(mlInferenceRuns.startedAt))
      .limit(limit)

    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        entityId: r.entityId,
        modelId: r.modelId,
        modelKey: r.modelKey,
        status: r.status,
        startedAt: r.startedAt.toISOString(),
        finishedAt: r.finishedAt?.toISOString() ?? null,
        inputPeriodStart: r.inputPeriodStart,
        inputPeriodEnd: r.inputPeriodEnd,
        summaryJson: r.summaryJson,
        error: r.error,
        createdAt: r.createdAt.toISOString(),
      })),
    )
  } catch (err) {
    console.error('[ML /runs/inference]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

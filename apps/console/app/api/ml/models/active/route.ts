// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * GET /api/ml/models/active
 *
 * Returns the active model(s) for a given entityId.
 * RBAC: any active entity member.
 *
 * Query params:
 *   entityId    required
 *   modelKey    optional — filter to a specific model key
 */
import { NextRequest, NextResponse } from 'next/server'
import { platformDb } from '@nzila/db/platform'
import { mlModels } from '@nzila/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireEntityAccess } from '@/lib/api-guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const entityId = searchParams.get('entityId')
    const modelKey = searchParams.get('modelKey')

    if (!entityId) {
      return NextResponse.json({ error: 'entityId is required' }, { status: 400 })
    }

    const access = await requireEntityAccess(entityId)
    if (!access.ok) return access.response

    const rows = await platformDb
      .select({
        id: mlModels.id,
        entityId: mlModels.entityId,
        modelKey: mlModels.modelKey,
        algorithm: mlModels.algorithm,
        version: mlModels.version,
        status: mlModels.status,
        trainingDatasetId: mlModels.trainingDatasetId,
        artifactDocumentId: mlModels.artifactDocumentId,
        metricsDocumentId: mlModels.metricsDocumentId,
        approvedBy: mlModels.approvedBy,
        approvedAt: mlModels.approvedAt,
        createdAt: mlModels.createdAt,
        updatedAt: mlModels.updatedAt,
      })
      .from(mlModels)
      .where(
        and(
          eq(mlModels.entityId, entityId),
          eq(mlModels.status, 'active'),
          ...(modelKey ? [eq(mlModels.modelKey, modelKey)] : []),
        ),
      )

    return NextResponse.json(
      rows.map((m) => ({
        id: m.id,
        entityId: m.entityId,
        modelKey: m.modelKey,
        algorithm: m.algorithm,
        version: m.version,
        status: m.status,
        meta: {
          trainingDatasetId: m.trainingDatasetId,
          artifactDocumentId: m.artifactDocumentId,
          metricsDocumentId: m.metricsDocumentId,
          approvedBy: m.approvedBy,
          approvedAt: m.approvedAt?.toISOString() ?? null,
        },
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
      })),
    )
  } catch (err) {
    console.error('[ML /models/active]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

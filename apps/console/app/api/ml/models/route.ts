// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * GET /api/ml/models
 *
 * Returns all ML models (all statuses) for a given entityId.
 * RBAC: any active entity member.
 *
 * Query params:
 *   entityId    required
 *   status      optional — filter to a specific status (draft|active|retired)
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@nzila/db'
import { mlModels } from '@nzila/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { requireEntityAccess } from '@/lib/api-guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const entityId = searchParams.get('entityId')
    const status = searchParams.get('status')

    if (!entityId) {
      return NextResponse.json({ error: 'entityId is required' }, { status: 400 })
    }

    const access = await requireEntityAccess(entityId)
    if (!access.ok) return access.response

    const conditions = [
      eq(mlModels.entityId, entityId),
      ...(status ? [eq(mlModels.status, status as 'draft' | 'active' | 'retired')] : []),
    ]

    const rows = await db
      .select()
      .from(mlModels)
      .where(and(...conditions))
      .orderBy(desc(mlModels.createdAt))

    return NextResponse.json(
      rows.map((m) => ({
        id: m.id,
        entityId: m.entityId,
        modelKey: m.modelKey,
        algorithm: m.algorithm,
        version: m.version,
        status: m.status,
        hyperparamsJson: m.hyperparamsJson,
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
    console.error('[ML /models]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

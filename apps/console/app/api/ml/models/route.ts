// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * GET /api/ml/models
 *
 * Returns all ML models (all statuses) for a given orgId.
 * RBAC: unknown active entity member.
 *
 * Query params:
 *   orgId    required
 *   status      optional — filter to a specific status (draft|active|retired)
 */
import { NextRequest, NextResponse } from 'next/server'
import { platformDb } from '@nzila/db/platform'
import { mlModels } from '@nzila/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { requireOrgAccess } from '@/lib/api-guards'
import { createLogger } from '@nzila/os-core'

const logger = createLogger('ml:models')

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const orgId = searchParams.get('orgId')
    const status = searchParams.get('status')

    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
    }

    const access = await requireOrgAccess(orgId)
    if (!access.ok) return access.response

    const conditions = [
      eq(mlModels.orgId, orgId),
      ...(status ? [eq(mlModels.status, status as 'draft' | 'active' | 'retired')] : []),
    ]

    const rows = await platformDb
      .select()
      .from(mlModels)
      .where(and(...conditions))
      .orderBy(desc(mlModels.createdAt))

    return NextResponse.json(
      rows.map((m) => ({
        id: m.id,
        orgId: m.orgId,
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
    logger.error('[ML /models]', err instanceof Error ? err : { detail: err })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

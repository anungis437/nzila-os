// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * GET /api/ml/models/active
 *
 * Returns the active model(s) for a given orgId.
 * RBAC: unknown active entity member.
 *
 * Query params:
 *   orgId    required
 *   modelKey    optional — filter to a specific model key
 */
import { NextRequest, NextResponse } from 'next/server'
import { platformDb } from '@nzila/db/platform'
import { mlModels } from '@nzila/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireOrgAccess } from '@/lib/api-guards'
import { createLogger } from '@nzila/os-core'

const logger = createLogger('ml:models:active')

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const orgId = searchParams.get('orgId')
    const modelKey = searchParams.get('modelKey')

    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
    }

    const access = await requireOrgAccess(orgId)
    if (!access.ok) return access.response

    const rows = await platformDb
      .select({
        id: mlModels.id,
        orgId: mlModels.orgId,
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
          eq(mlModels.orgId, orgId),
          eq(mlModels.status, 'active'),
          ...(modelKey ? [eq(mlModels.modelKey, modelKey)] : []),
        ),
      )

    return NextResponse.json(
      rows.map((m) => ({
        id: m.id,
        orgId: m.orgId,
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
    logger.error('[ML /models/active]', err instanceof Error ? err : { detail: err })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

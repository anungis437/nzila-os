// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * GET /api/ml/runs/training
 *
 * Returns recent training runs for an entity.
 * RBAC: unknown active entity member.
 *
 * Query params:
 *   orgId    required
 *   modelKey    optional — filter to a specific model key
 *   limit       optional — default 20, max 100
 */
import { NextRequest, NextResponse } from 'next/server'
import { platformDb } from '@nzila/db/platform'
import { mlTrainingRuns } from '@nzila/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { requireOrgAccess } from '@/lib/api-guards'
import { createLogger } from '@nzila/os-core'

const logger = createLogger('ml:runs:training')

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const orgId = searchParams.get('orgId')
    const modelKey = searchParams.get('modelKey')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100)

    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
    }

    const access = await requireOrgAccess(orgId)
    if (!access.ok) return access.response

    const rows = await platformDb
      .select()
      .from(mlTrainingRuns)
      .where(
        and(
          eq(mlTrainingRuns.orgId, orgId),
          ...(modelKey ? [eq(mlTrainingRuns.modelKey, modelKey)] : []),
        ),
      )
      .orderBy(desc(mlTrainingRuns.startedAt))
      .limit(limit)

    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        orgId: r.orgId,
        modelKey: r.modelKey,
        datasetId: r.datasetId,
        status: r.status,
        startedAt: r.startedAt.toISOString(),
        finishedAt: r.finishedAt?.toISOString() ?? null,
        error: r.error,
        createdAt: r.createdAt.toISOString(),
      })),
    )
  } catch (err) {
    logger.error('[ML /runs/training]', err instanceof Error ? err : { detail: err })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

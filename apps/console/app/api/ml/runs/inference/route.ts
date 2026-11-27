import { listMlInferenceRuns } from '@/lib/services/ml-read-service'
// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * GET /api/ml/runs/inference
 *
 * Returns recent inference runs for an entity.
 * RBAC: unknown active entity member.
 *
 * Query params:
 *   orgId    required
 *   modelId     optional — filter to a specific model
 *   limit       optional — default 20, max 100
 */
import { NextRequest, NextResponse } from 'next/server'

import { requireOrgAccess } from '@/lib/api-guards'
import { createLogger } from '@nzila/os-core'

const logger = createLogger('ml:runs:inference')

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const orgId = searchParams.get('orgId')
    const modelId = searchParams.get('modelId')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100)

    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
    }

    const access = await requireOrgAccess(orgId)
    if (!access.ok) return access.response

    const result = await listMlInferenceRuns({ orgId, modelId, limit })
    return NextResponse.json(result.body, { status: result.status })
  } catch (err) {
    logger.error('[ML /runs/inference]', err instanceof Error ? err : { detail: err })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

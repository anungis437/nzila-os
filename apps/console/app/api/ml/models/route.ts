import { listMlModels } from '@/lib/services/ml-read-service'
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

    const result = await listMlModels({ orgId, status })
    return NextResponse.json(result.body, { status: result.status })
  } catch (err) {
    logger.error('[ML /models]', err instanceof Error ? err : { detail: err })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

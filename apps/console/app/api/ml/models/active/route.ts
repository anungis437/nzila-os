import { listActiveMlModels } from '@/lib/services/ml-read-service'
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

    const result = await listActiveMlModels({ orgId, modelKey })
    return NextResponse.json(result.body, { status: result.status })
  } catch (err) {
    logger.error('[ML /models/active]', err instanceof Error ? err : { detail: err })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

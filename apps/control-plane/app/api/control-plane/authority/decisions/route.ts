/**
 * Control Plane API — Decision Events
 *
 * GET  /api/control-plane/authority/decisions?orgId=&correlationId=&workflowId=
 * POST /api/control-plane/authority/decisions
 *
 * Query or directly record decision events.
 * Console uses GET to display decision lineage.
 * Authority services use POST internally (prefer calling recordDecisionEvent directly).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireApiAuth, handleAuthError } from '@/lib/api-auth'
import {
  recordDecisionEvent,
  getDecisionsByCorrelationId,
  getDecisionsByWorkflowId,
  getDecisionsForOrg,
} from '@/server/authority/decision'
import { DecisionEventTypeSchema } from '@nzila/platform-contracts/control-system'
import { z } from 'zod'
import { createLogger } from '@nzila/os-core'

export const dynamic = 'force-dynamic'

const logger = createLogger('control-plane:api:authority:decisions')

const RecordDecisionBodySchema = z.object({
  type: DecisionEventTypeSchema,
  orgId: z.string().uuid(),
  actorId: z.string().min(1),
  action: z.string().min(1),
  resource: z.string().min(1),
  resourceId: z.string().optional(),
  outcome: z.enum(['allowed', 'denied', 'approved_required', 'executed', 'recorded']),
  reason: z.string().optional(),
  policyIds: z.array(z.string()).optional(),
  workflowId: z.string().optional(),
  correlationId: z.string().uuid().optional(),
  requestId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
})

export async function GET(request: NextRequest) {
  try {
    await requireApiAuth(request)
  } catch (err) {
    return handleAuthError(err)
  }

  const { searchParams } = request.nextUrl
  const orgId = searchParams.get('orgId')
  const correlationId = searchParams.get('correlationId')
  const workflowId = searchParams.get('workflowId')

  if (correlationId) {
    const records = getDecisionsByCorrelationId(correlationId)
    return NextResponse.json({ ok: true, data: records, count: records.length })
  }

  if (workflowId) {
    const records = getDecisionsByWorkflowId(workflowId)
    return NextResponse.json({ ok: true, data: records, count: records.length })
  }

  if (orgId) {
    const limitStr = searchParams.get('limit')
    const limit = limitStr ? Math.min(parseInt(limitStr, 10), 200) : 50
    const records = getDecisionsForOrg(orgId, limit)
    return NextResponse.json({ ok: true, data: records, count: records.length })
  }

  return NextResponse.json(
    { ok: false, error: { code: 'MISSING_FILTER', message: 'Provide orgId, correlationId, or workflowId' } },
    { status: 400 },
  )
}

export async function POST(request: NextRequest) {
  try {
    await requireApiAuth(request)
  } catch (err) {
    return handleAuthError(err)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' } },
      { status: 400 },
    )
  }

  const parsed = RecordDecisionBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: 'INVALID_REQUEST', message: 'Invalid decision event body', details: parsed.error.flatten() } },
      { status: 400 },
    )
  }

  const record = await recordDecisionEvent(parsed.data)
  logger.info('Decision event recorded via API', { id: record.id, type: record.type })
  return NextResponse.json({ ok: true, data: record }, { status: 201 })
}

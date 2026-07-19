/**
 * Platform Admin — SAGE Phase 8B internal destruction execution API
 *
 * POST /api/internal/sage/destruction/[requestId]/execute
 *
 * Service-authenticated entrypoint (same hardened pattern as the notification
 * dispatcher): a scheduler / operator job invokes destruction execution for an
 * APPROVED request. Execution never requests, approves, or denies — it only runs
 * the idempotent, fenced, verify-before-tombstone deletion. Ordinary user and
 * recipient sessions can never reach this route.
 *
 * The org/workspace scope is supplied by the trusted internal caller and used to
 * load the approved request; execution authority is the dedicated execute
 * permission, injected only for this internal system actor.
 */
import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { executeDestructionInternal, SageServiceError } from '@/lib/sage/records-service'
import { sageErrorResponse } from '@/lib/sage/route-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.SAGE_CRON_SECRET
  const provided = request.headers.get('x-sage-internal-token')
  if (!expected || !provided) return false
  const left = Buffer.from(expected)
  const right = Buffer.from(provided)
  return left.length === right.length && timingSafeEqual(left, right)
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  if (!isAuthorized(request)) return NextResponse.json({ ok: false }, { status: 401 })
  const { requestId } = await context.params
  let body: { orgId?: unknown; workspaceId?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: { code: 'INVALID_JSON', message: 'Body must be JSON' } }, { status: 400 })
  }
  if (typeof body.orgId !== 'string' || typeof body.workspaceId !== 'string') {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_FAILED', message: 'orgId and workspaceId are required' } },
      { status: 400 },
    )
  }
  try {
    const evidence = await executeDestructionInternal({ orgId: body.orgId, workspaceId: body.workspaceId, requestId })
    return NextResponse.json({ ok: true, data: { result: evidence.result, destructionRequestId: evidence.destructionRequestId } })
  } catch (error) {
    if (error instanceof SageServiceError) return sageErrorResponse(error)
    return NextResponse.json({ ok: false, error: { code: 'EXECUTION_UNAVAILABLE' } }, { status: 503 })
  }
}

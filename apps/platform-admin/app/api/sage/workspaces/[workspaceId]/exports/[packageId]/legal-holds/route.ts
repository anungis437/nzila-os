/**
 * Platform Admin — SAGE Phase 8B legal-holds API
 *
 * GET  /api/sage/workspaces/[workspaceId]/exports/[packageId]/legal-holds
 * POST /api/sage/workspaces/[workspaceId]/exports/[packageId]/legal-holds
 *
 * Places a named, human-only legal hold on an immutable package. Any active hold
 * blocks destruction. Placement authority is a dedicated SAGE role — generic
 * platform/org administration never confers it.
 */
import { NextRequest, NextResponse } from 'next/server'
import { withOrgScope, withOrgWrite } from '@/lib/org-scope-guard'
import { listLegalHoldsForScope, placeLegalHoldForScope } from '@/lib/sage/records-service'
import { placeLegalHoldSchema } from '@/lib/sage/records-schemas'
import { sageErrorResponse, sageNotFoundResponse } from '@/lib/sage/route-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string; packageId: string }> },
) {
  const { workspaceId, packageId } = await context.params
  return withOrgScope(request, async (ctx) => {
    try {
      const data = await listLegalHoldsForScope(ctx, { workspaceId, packageId })
      if (!data) return sageNotFoundResponse()
      return NextResponse.json({ ok: true, data })
    } catch (error) {
      return sageErrorResponse(error)
    }
  })
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string; packageId: string }> },
) {
  const { workspaceId, packageId } = await context.params
  const idempotencyKey = request.headers.get('Idempotency-Key')
  if (!idempotencyKey || idempotencyKey.trim().length === 0) {
    return NextResponse.json(
      { ok: false, error: { code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Idempotency-Key header is required' } },
      { status: 400 },
    )
  }
  return withOrgWrite(request, async (ctx) => {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: { code: 'INVALID_JSON', message: 'Body must be JSON' } }, { status: 400 })
    }
    const parsed = placeLegalHoldSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_FAILED', message: 'Invalid legal hold payload', details: parsed.error.flatten() } },
        { status: 400 },
      )
    }
    try {
      const result = await placeLegalHoldForScope(ctx, { workspaceId, packageId, reason: parsed.data.reason }, { idempotencyKey })
      return NextResponse.json({ ok: true, data: result.response }, { status: result.replayed ? 200 : 201 })
    } catch (error) {
      return sageErrorResponse(error)
    }
  })
}

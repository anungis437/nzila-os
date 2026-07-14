/**
 * Platform Admin — SAGE delivery requests API
 *
 * GET  /api/sage/workspaces/[workspaceId]/delivery-requests — list requests
 * POST /api/sage/workspaces/[workspaceId]/delivery-requests — request delivery
 *
 * The request names one existing immutable package + one email-verified recipient and
 * a bounded access window/count. The frozen package/recipient hashes are derived
 * server-side; the body is `.strict()` and cannot supply them.
 */
import { NextRequest, NextResponse } from 'next/server'
import { withOrgScope, withOrgWrite } from '@/lib/org-scope-guard'
import {
  createDeliveryRequestForScope,
  listDeliveryRequestsForScope,
} from '@/lib/sage/delivery-service'
import { CreateDeliveryRequestRequest } from '@/lib/sage/delivery-schemas'
import { sageErrorResponse, sageNotFoundResponse } from '@/lib/sage/route-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, context: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await context.params
  return withOrgScope(request, async (ctx) => {
    try {
      const data = await listDeliveryRequestsForScope(ctx, workspaceId)
      if (!data) return sageNotFoundResponse()
      return NextResponse.json({ ok: true, data })
    } catch (error) {
      return sageErrorResponse(error)
    }
  })
}

export async function POST(request: NextRequest, context: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await context.params
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
    const parsed = CreateDeliveryRequestRequest.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_FAILED', message: 'Invalid delivery request payload', details: parsed.error.flatten() } },
        { status: 400 },
      )
    }
    try {
      const result = await createDeliveryRequestForScope(ctx, workspaceId, parsed.data, { idempotencyKey })
      return NextResponse.json({ ok: true, data: result.response }, { status: result.replayed ? 200 : 201 })
    } catch (error) {
      return sageErrorResponse(error)
    }
  })
}

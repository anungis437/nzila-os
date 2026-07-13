/**
 * Platform Admin — SAGE delivery approval API
 *
 * POST /api/sage/workspaces/[workspaceId]/delivery-requests/[requestId]/approve
 *
 * Independent human approval of the exact package↔recipient pairing. The
 * approver must be a DIFFERENT authenticated human with delivery-approve
 * authority; approval freezes the package/recipient hashes. Enforced in-service.
 */
import { NextRequest, NextResponse } from 'next/server'
import { withOrgWrite } from '@/lib/org-scope-guard'
import { approveDeliveryRequestForScope } from '@/lib/sage/delivery-service'
import { DecideDeliveryRequestRequest } from '@/lib/sage/delivery-schemas'
import { sageErrorResponse } from '@/lib/sage/route-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string; requestId: string }> },
) {
  const { workspaceId, requestId } = await context.params
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
    const parsed = DecideDeliveryRequestRequest.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_FAILED', message: 'Invalid approval payload', details: parsed.error.flatten() } },
        { status: 400 },
      )
    }
    try {
      const result = await approveDeliveryRequestForScope(ctx, workspaceId, requestId, parsed.data.rationale, { idempotencyKey })
      return NextResponse.json({ ok: true, data: result.response }, { status: 200 })
    } catch (error) {
      return sageErrorResponse(error)
    }
  })
}

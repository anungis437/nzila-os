/**
 * Platform Admin — SAGE delivery invitation issuance API
 *
 * POST /api/sage/workspaces/[workspaceId]/delivery-requests/[requestId]/issue
 *
 * Issues a one-time invitation for an approved request. The invitation token is
 * delivered ONLY via the notification provider — it is never returned to the
 * browser. Issuance fails closed when no provider is configured.
 */
import { NextRequest, NextResponse } from 'next/server'
import { withOrgWrite } from '@/lib/org-scope-guard'
import { issueDeliveryInvitationForScope } from '@/lib/sage/delivery-service'
import { IssueDeliveryInvitationRequest } from '@/lib/sage/delivery-schemas'
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
    let body: unknown = {}
    try {
      const text = await request.text()
      body = text ? JSON.parse(text) : {}
    } catch {
      return NextResponse.json({ ok: false, error: { code: 'INVALID_JSON', message: 'Body must be JSON' } }, { status: 400 })
    }
    const parsed = IssueDeliveryInvitationRequest.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_FAILED', message: 'Invalid issuance payload', details: parsed.error.flatten() } },
        { status: 400 },
      )
    }
    try {
      const result = await issueDeliveryInvitationForScope(ctx, workspaceId, requestId, { idempotencyKey })
      return NextResponse.json({ ok: true, data: result.response }, { status: result.replayed ? 200 : 201 })
    } catch (error) {
      return sageErrorResponse(error)
    }
  })
}

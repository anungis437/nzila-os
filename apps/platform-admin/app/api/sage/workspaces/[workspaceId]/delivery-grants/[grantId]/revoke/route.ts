/**
 * Platform Admin — SAGE delivery grant revocation API
 *
 * POST /api/sage/workspaces/[workspaceId]/delivery-grants/[grantId]/revoke
 *
 * Immediate revocation by an authorized human with delivery-revoke authority. A
 * bounded reason code is required. Blocks all later claim/access/download.
 */
import { NextRequest, NextResponse } from 'next/server'
import { withOrgWrite } from '@/lib/org-scope-guard'
import { revokeDeliveryGrantForScope } from '@/lib/sage/delivery-service'
import { RevokeDeliveryGrantRequest } from '@/lib/sage/delivery-schemas'
import { sageErrorResponse } from '@/lib/sage/route-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string; grantId: string }> },
) {
  const { workspaceId, grantId } = await context.params
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
    const parsed = RevokeDeliveryGrantRequest.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_FAILED', message: 'Invalid revocation payload', details: parsed.error.flatten() } },
        { status: 400 },
      )
    }
    try {
      const result = await revokeDeliveryGrantForScope(ctx, workspaceId, grantId, parsed.data.revocationReasonCode, { idempotencyKey })
      return NextResponse.json({ ok: true, data: result.response }, { status: 200 })
    } catch (error) {
      return sageErrorResponse(error)
    }
  })
}

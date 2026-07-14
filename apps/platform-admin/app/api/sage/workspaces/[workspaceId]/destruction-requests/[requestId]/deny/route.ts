/**
 * Platform Admin — SAGE Phase 8B destruction denial API
 *
 * POST /api/sage/workspaces/[workspaceId]/destruction-requests/[requestId]/deny
 *
 * A DIFFERENT authorized human denies the destruction request. Append-only.
 */
import { NextRequest, NextResponse } from 'next/server'
import { withOrgWrite } from '@/lib/org-scope-guard'
import { decideDestructionForScope } from '@/lib/sage/records-service'
import { decideDestructionSchema } from '@/lib/sage/records-schemas'
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
      body = await request.json()
    } catch {
      body = {}
    }
    const parsed = decideDestructionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_FAILED', message: 'Invalid denial payload', details: parsed.error.flatten() } },
        { status: 400 },
      )
    }
    try {
      const result = await decideDestructionForScope(
        ctx,
        { workspaceId, requestId, decision: 'denied', rationale: parsed.data.rationale },
        { idempotencyKey },
      )
      return NextResponse.json({ ok: true, data: result.response }, { status: 200 })
    } catch (error) {
      return sageErrorResponse(error)
    }
  })
}

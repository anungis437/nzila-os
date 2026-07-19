/**
 * Platform Admin — SAGE Phase 8B legal-hold release API
 *
 * POST /api/sage/workspaces/[workspaceId]/exports/[packageId]/legal-holds/[holdId]/release
 *
 * Releases an active legal hold (human-only, dedicated authority). The original
 * hold is never erased — release is an append of release fields via CAS.
 */
import { NextRequest, NextResponse } from 'next/server'
import { withOrgWrite } from '@/lib/org-scope-guard'
import { releaseLegalHoldForScope } from '@/lib/sage/records-service'
import { releaseLegalHoldSchema } from '@/lib/sage/records-schemas'
import { sageErrorResponse } from '@/lib/sage/route-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string; packageId: string; holdId: string }> },
) {
  const { workspaceId, holdId } = await context.params
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
    const parsed = releaseLegalHoldSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_FAILED', message: 'Invalid release payload', details: parsed.error.flatten() } },
        { status: 400 },
      )
    }
    try {
      const result = await releaseLegalHoldForScope(ctx, { workspaceId, holdId, releaseReason: parsed.data.releaseReason }, { idempotencyKey })
      return NextResponse.json({ ok: true, data: result.response }, { status: 200 })
    } catch (error) {
      return sageErrorResponse(error)
    }
  })
}

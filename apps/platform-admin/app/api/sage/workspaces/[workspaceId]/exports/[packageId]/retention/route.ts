/**
 * Platform Admin — SAGE Phase 8B retention API
 *
 * GET  /api/sage/workspaces/[workspaceId]/exports/[packageId]/retention
 * POST /api/sage/workspaces/[workspaceId]/exports/[packageId]/retention
 *
 * Assigns the one authoritative, versioned retention policy for an immutable
 * package. retain_until is computed once inside the SAGE service layer from the
 * approved basis; the body is `.strict()` and cannot supply server-derived state.
 */
import { NextRequest, NextResponse } from 'next/server'
import { withOrgScope, withOrgWrite } from '@/lib/org-scope-guard'
import { assignRetentionForScope, getRetentionForScope } from '@/lib/sage/records-service'
import { assignRetentionSchema } from '@/lib/sage/records-schemas'
import { sageErrorResponse } from '@/lib/sage/route-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string; packageId: string }> },
) {
  const { workspaceId, packageId } = await context.params
  return withOrgScope(request, async (ctx) => {
    try {
      const data = await getRetentionForScope(ctx, { workspaceId, packageId })
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
    const parsed = assignRetentionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_FAILED', message: 'Invalid retention payload', details: parsed.error.flatten() } },
        { status: 400 },
      )
    }
    try {
      const result = await assignRetentionForScope(ctx, { workspaceId, packageId, ...parsed.data }, { idempotencyKey })
      return NextResponse.json({ ok: true, data: result.response }, { status: result.replayed ? 200 : 201 })
    } catch (error) {
      return sageErrorResponse(error)
    }
  })
}

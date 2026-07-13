/**
 * Platform Admin — SAGE export denial API
 *
 * POST /api/sage/workspaces/[workspaceId]/export-requests/[requestId]/deny
 *
 * Independent human denial (rationale required). A requester cannot deny their
 * own request. Separate from approval (no generic status endpoint). Enforced
 * in-service with compare-and-set semantics.
 */
import { NextRequest, NextResponse } from 'next/server'
import { withOrgWrite } from '@/lib/org-scope-guard'
import { denySageExportRequestForScope } from '@/lib/sage/export-service'
import { DenyExportRequestRequest } from '@/lib/sage/export-schemas'
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
      return NextResponse.json(
        { ok: false, error: { code: 'INVALID_JSON', message: 'Body must be JSON' } },
        { status: 400 },
      )
    }
    const parsed = DenyExportRequestRequest.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_FAILED', message: 'Invalid denial payload', details: parsed.error.flatten() } },
        { status: 400 },
      )
    }
    try {
      const result = await denySageExportRequestForScope(
        ctx,
        workspaceId,
        requestId,
        parsed.data.rationale,
        { idempotencyKey },
      )
      return NextResponse.json({ ok: true, data: result.response }, { status: 200 })
    } catch (error) {
      return sageErrorResponse(error)
    }
  })
}

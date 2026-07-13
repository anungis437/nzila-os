/**
 * Platform Admin — SAGE export approval API
 *
 * POST /api/sage/workspaces/[workspaceId]/export-requests/[requestId]/approve
 *
 * Independent human approval: the approver must be a different authenticated
 * human with the export_approver role, must access the entire scope, and the
 * scope hash must be unchanged. Approval freezes the reviewed scope. Enforced
 * in-service. Approval and denial are SEPARATE endpoints (no generic status).
 */
import { NextRequest, NextResponse } from 'next/server'
import { withOrgWrite } from '@/lib/org-scope-guard'
import { approveSageExportRequestForScope } from '@/lib/sage/export-service'
import { ApproveExportRequestRequest } from '@/lib/sage/export-schemas'
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
    const parsed = ApproveExportRequestRequest.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_FAILED', message: 'Invalid approval payload', details: parsed.error.flatten() } },
        { status: 400 },
      )
    }
    try {
      const result = await approveSageExportRequestForScope(
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

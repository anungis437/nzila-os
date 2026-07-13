/**
 * Platform Admin — SAGE export requests API
 *
 * GET  /api/sage/workspaces/[workspaceId]/export-requests — list requests
 * POST /api/sage/workspaces/[workspaceId]/export-requests — open a request
 *
 * Org-scoped; orgId/requesterId derived from the session. Export-request
 * authority (membership + active SAGE role) and human-actor assurance are
 * enforced in-service. The create body is `.strict()`-validated. External
 * delivery is disabled — there is no recipient/destination field.
 */
import { NextRequest, NextResponse } from 'next/server'
import { withOrgScope, withOrgWrite } from '@/lib/org-scope-guard'
import {
  createSageExportRequestForScope,
  listSageExportRequestsForScope,
} from '@/lib/sage/export-service'
import { CreateExportRequestRequest } from '@/lib/sage/export-schemas'
import { sageErrorResponse, sageNotFoundResponse } from '@/lib/sage/route-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await context.params
  return withOrgScope(request, async (ctx) => {
    try {
      const data = await listSageExportRequestsForScope(ctx, workspaceId)
      if (!data) return sageNotFoundResponse()
      return NextResponse.json({ ok: true, data })
    } catch (error) {
      return sageErrorResponse(error)
    }
  })
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
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
      return NextResponse.json(
        { ok: false, error: { code: 'INVALID_JSON', message: 'Body must be JSON' } },
        { status: 400 },
      )
    }
    const parsed = CreateExportRequestRequest.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: 'VALIDATION_FAILED', message: 'Invalid export request payload', details: parsed.error.flatten() },
        },
        { status: 400 },
      )
    }
    try {
      const result = await createSageExportRequestForScope(ctx, workspaceId, parsed.data, { idempotencyKey })
      return NextResponse.json({ ok: true, data: result.response }, { status: result.replayed ? 200 : 201 })
    } catch (error) {
      return sageErrorResponse(error)
    }
  })
}

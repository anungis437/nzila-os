/**
 * Platform Admin — SAGE evidence sources API
 *
 * GET  /api/sage/workspaces/[workspaceId]/evidence-sources — list (read scope)
 * POST /api/sage/workspaces/[workspaceId]/evidence-sources — register (write)
 *
 * Org-scoped via `withOrgScope` / `withOrgWrite`; orgId and actorId derive from
 * the verified session — never from the request body. Per-workspace evidence
 * access (membership + active SAGE role) is enforced inside the SAGE service.
 * The create body is `.strict()`-validated, so a client cannot supply orgId,
 * actorId, workspaceId, createdBy, or an authorization level (classification is
 * a separate, later step). Missing/cross-org/denied workspaces return 404.
 */
import { NextRequest, NextResponse } from 'next/server'
import { withOrgScope, withOrgWrite } from '@/lib/org-scope-guard'
import {
  createSageEvidenceSourceForScope,
  listSageEvidenceSourcesForScope,
} from '@/lib/sage/evidence-service'
import { CreateEvidenceSourceRequest } from '@/lib/sage/evidence-schemas'
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
      const data = await listSageEvidenceSourcesForScope(ctx, workspaceId)
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
      {
        ok: false,
        error: { code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Idempotency-Key header is required' },
      },
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

    const parsed = CreateEvidenceSourceRequest.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid evidence source payload',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 },
      )
    }

    try {
      const result = await createSageEvidenceSourceForScope(ctx, workspaceId, parsed.data, {
        idempotencyKey,
      })
      return NextResponse.json(
        { ok: true, data: result.response },
        { status: result.replayed ? 200 : 201 },
      )
    } catch (error) {
      return sageErrorResponse(error)
    }
  })
}

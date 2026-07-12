/**
 * Platform Admin — SAGE evidence items API
 *
 * GET  /api/sage/workspaces/[workspaceId]/evidence-items[?sourceId=…] — list
 * POST /api/sage/workspaces/[workspaceId]/evidence-items — create (write)
 *
 * Org-scoped; orgId/actorId from the session. Items are authorization-filtered
 * by their source in-service (an item is visible only when its source is). The
 * create body is `.strict()`-validated. A source must be classified before an
 * item can be created (enforced in-service). Missing/cross-org/denied → 404.
 */
import { NextRequest, NextResponse } from 'next/server'
import { withOrgScope, withOrgWrite } from '@/lib/org-scope-guard'
import {
  createSageEvidenceItemForScope,
  listSageEvidenceItemsForScope,
} from '@/lib/sage/evidence-service'
import { CreateEvidenceItemRequest } from '@/lib/sage/evidence-schemas'
import { sageErrorResponse, sageNotFoundResponse } from '@/lib/sage/route-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await context.params
  const sourceId = request.nextUrl.searchParams.get('sourceId') ?? undefined
  return withOrgScope(request, async (ctx) => {
    try {
      const data = await listSageEvidenceItemsForScope(ctx, workspaceId, sourceId)
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

    const parsed = CreateEvidenceItemRequest.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid evidence item payload',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 },
      )
    }

    try {
      const result = await createSageEvidenceItemForScope(ctx, workspaceId, parsed.data, {
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

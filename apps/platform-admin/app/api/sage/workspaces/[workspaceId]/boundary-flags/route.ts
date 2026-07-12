/**
 * Platform Admin — SAGE boundary flags API
 *
 * GET  /api/sage/workspaces/[workspaceId]/boundary-flags[?status=…] — list
 * POST /api/sage/workspaces/[workspaceId]/boundary-flags — open a flag
 *
 * Org-scoped; orgId/actorId from the session. Boundary-flag authority
 * (membership + active SAGE role with BOUNDARY_FLAG) is enforced in-service.
 * Flags on evidence targets the actor cannot access are hidden. The create body
 * is `.strict()`-validated. Missing/cross-org/denied resolve to 404.
 */
import { NextRequest, NextResponse } from 'next/server'
import { withOrgScope, withOrgWrite } from '@/lib/org-scope-guard'
import {
  createSageBoundaryFlagForScope,
  listSageBoundaryFlagsForScope,
} from '@/lib/sage/governance-service'
import { CreateBoundaryFlagRequest } from '@/lib/sage/governance-schemas'
import { sageErrorResponse, sageNotFoundResponse } from '@/lib/sage/route-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await context.params
  const status = request.nextUrl.searchParams.get('status') ?? undefined
  return withOrgScope(request, async (ctx) => {
    try {
      const data = await listSageBoundaryFlagsForScope(ctx, workspaceId, { status })
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

    const parsed = CreateBoundaryFlagRequest.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid boundary flag payload',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 },
      )
    }

    try {
      const result = await createSageBoundaryFlagForScope(ctx, workspaceId, parsed.data, {
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

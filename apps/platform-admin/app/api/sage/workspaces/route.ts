/**
 * Platform Admin — SAGE workspaces API
 *
 * GET  /api/sage/workspaces  — list the org's SAGE workspaces (read scope)
 * POST /api/sage/workspaces  — create a workspace (write scope)
 *
 * All requests are org-scoped via `withOrgScope` / `withOrgWrite`. orgId and
 * actorId derive from the verified session scope — never from the request body.
 * The create body is `.strict()`-validated, so a client cannot supply orgId,
 * actorId, createdBy, or boundaryProfile. Mutations go through the SAGE service
 * layer (permission checks + invariants + audit emission).
 */
import { NextRequest, NextResponse } from 'next/server'
import { withOrgScope, withOrgWrite } from '../../../../lib/org-scope-guard'
import {
  createSageWorkspaceForScope,
  listSageWorkspacesForScope,
} from '../../../../lib/sage/workspace-service'
import { CreateSageWorkspaceRequest } from '../../../../lib/sage/schemas'
import { sageErrorResponse } from '../../../../lib/sage/route-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return withOrgScope(request, async (ctx) => {
    try {
      const data = await listSageWorkspacesForScope(ctx)
      return NextResponse.json({ ok: true, data })
    } catch (error) {
      return sageErrorResponse(error)
    }
  })
}

export async function POST(request: NextRequest) {
  const idempotencyKey = request.headers.get('Idempotency-Key')
  if (!idempotencyKey || idempotencyKey.trim().length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'IDEMPOTENCY_KEY_REQUIRED',
          message: 'Idempotency-Key header is required',
        },
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

    // `.strict()` rejects any extra field — including a client-supplied orgId,
    // actorId, createdBy, or boundaryProfile.
    const parsed = CreateSageWorkspaceRequest.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid workspace payload',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 },
      )
    }

    try {
      const result = await createSageWorkspaceForScope(ctx, parsed.data, { idempotencyKey })
      return NextResponse.json(
        { ok: true, data: result.response },
        { status: result.replayed ? 200 : 201 },
      )
    } catch (error) {
      return sageErrorResponse(error)
    }
  })
}

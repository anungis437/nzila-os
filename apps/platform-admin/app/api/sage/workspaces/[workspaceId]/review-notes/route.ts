/**
 * Platform Admin — SAGE review notes API
 *
 * GET  /api/sage/workspaces/[workspaceId]/review-notes — list visible notes
 * POST /api/sage/workspaces/[workspaceId]/review-notes — record a human note
 *
 * Org-scoped; orgId/actorId from the session. REVIEW_NOTE authority (membership
 * + active SAGE role) is enforced in-service. The reviewer identity is derived
 * from the authenticated actor — never from the body. Notes on evidence targets
 * the actor cannot access are hidden.
 */
import { NextRequest, NextResponse } from 'next/server'
import { withOrgScope, withOrgWrite } from '@/lib/org-scope-guard'
import {
  createSageReviewNoteForScope,
  listSageReviewNotesForScope,
} from '@/lib/sage/governance-service'
import { CreateReviewNoteRequest } from '@/lib/sage/governance-schemas'
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
      const data = await listSageReviewNotesForScope(ctx, workspaceId)
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

    const parsed = CreateReviewNoteRequest.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid review note payload',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 },
      )
    }

    try {
      const result = await createSageReviewNoteForScope(ctx, workspaceId, parsed.data, {
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

/**
 * Platform Admin — SAGE evidence item link API
 *
 * POST /api/sage/workspaces/[workspaceId]/evidence-items/[itemId]/link
 *
 * Transitions an evidence item to the linked lifecycle state. Org-scoped write;
 * orgId/actorId from the session. EVIDENCE_LINK authority and the
 * classified-source / authorized-only invariants are enforced in-service. The
 * body carries no user fields (`.strict({})`). Missing/cross-org/denied → 404.
 */
import { NextRequest, NextResponse } from 'next/server'
import { withOrgWrite } from '@/lib/org-scope-guard'
import { linkSageEvidenceItemForScope } from '@/lib/sage/evidence-service'
import { LinkEvidenceItemRequest } from '@/lib/sage/evidence-schemas'
import { sageErrorResponse } from '@/lib/sage/route-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string; itemId: string }> },
) {
  const { workspaceId, itemId } = await context.params
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
    // A link request carries no user-supplied fields; still parse to reject any
    // smuggled attributes when a body is present.
    let body: unknown = {}
    const raw = await request.text()
    if (raw.trim().length > 0) {
      try {
        body = JSON.parse(raw)
      } catch {
        return NextResponse.json(
          { ok: false, error: { code: 'INVALID_JSON', message: 'Body must be JSON' } },
          { status: 400 },
        )
      }
    }

    const parsed = LinkEvidenceItemRequest.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid link payload',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 },
      )
    }

    try {
      const result = await linkSageEvidenceItemForScope(ctx, workspaceId, itemId, {
        idempotencyKey,
      })
      return NextResponse.json({ ok: true, data: result.response }, { status: 200 })
    } catch (error) {
      return sageErrorResponse(error)
    }
  })
}

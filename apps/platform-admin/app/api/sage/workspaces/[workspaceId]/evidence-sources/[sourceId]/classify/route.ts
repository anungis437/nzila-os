/**
 * Platform Admin — SAGE evidence source classification API
 *
 * POST /api/sage/workspaces/[workspaceId]/evidence-sources/[sourceId]/classify
 *
 * Classifies an already-registered source (source quality + authorization
 * level). Org-scoped write; orgId/actorId from the session. The body is
 * `.strict()`-validated. EVIDENCE_CLASSIFY authority (membership + active SAGE
 * role) is enforced in-service; a missing/cross-org/denied source returns 404.
 */
import { NextRequest, NextResponse } from 'next/server'
import { withOrgWrite } from '@/lib/org-scope-guard'
import { classifySageEvidenceSourceForScope } from '@/lib/sage/evidence-service'
import { ClassifyEvidenceSourceRequest } from '@/lib/sage/evidence-schemas'
import { sageErrorResponse } from '@/lib/sage/route-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string; sourceId: string }> },
) {
  const { workspaceId, sourceId } = await context.params
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

    const parsed = ClassifyEvidenceSourceRequest.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid classification payload',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 },
      )
    }

    try {
      const result = await classifySageEvidenceSourceForScope(
        ctx,
        workspaceId,
        sourceId,
        parsed.data,
        { idempotencyKey },
      )
      return NextResponse.json({ ok: true, data: result.response }, { status: 200 })
    } catch (error) {
      return sageErrorResponse(error)
    }
  })
}

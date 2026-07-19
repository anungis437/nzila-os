/**
 * Platform Admin — SAGE boundary flag resolution API
 *
 * POST /api/sage/workspaces/[workspaceId]/boundary-flags/[flagId]/resolve
 *
 * Resolves or retains a boundary flag via a compare-and-set transition. Requires
 * BOUNDARY_FLAG authority (membership + active SAGE role) and a human resolution
 * note. The resolver identity is derived server-side. A stale/already-resolved
 * flag yields 409 (CONFLICT); the original flag is preserved.
 */
import { NextRequest, NextResponse } from 'next/server'
import { withOrgWrite } from '@/lib/org-scope-guard'
import { resolveSageBoundaryFlagForScope } from '@/lib/sage/governance-service'
import { ResolveBoundaryFlagRequest } from '@/lib/sage/governance-schemas'
import { sageErrorResponse } from '@/lib/sage/route-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string; flagId: string }> },
) {
  const { workspaceId, flagId } = await context.params
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

    const parsed = ResolveBoundaryFlagRequest.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid resolution payload',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 },
      )
    }

    try {
      const result = await resolveSageBoundaryFlagForScope(ctx, workspaceId, flagId, parsed.data, {
        idempotencyKey,
      })
      return NextResponse.json({ ok: true, data: result.response }, { status: 200 })
    } catch (error) {
      return sageErrorResponse(error)
    }
  })
}

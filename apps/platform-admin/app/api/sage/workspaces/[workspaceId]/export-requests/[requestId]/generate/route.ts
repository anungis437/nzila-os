/**
 * Platform Admin — SAGE export package generation API
 *
 * POST /api/sage/workspaces/[workspaceId]/export-requests/[requestId]/generate
 *
 * Generates the single immutable package for an approved request. The current
 * scope is recomputed and compared with the approved scope hash — any drift
 * blocks generation with 409 CONFLICT. Package-generation authority is required.
 * Idempotent: replay returns the existing package.
 */
import { NextRequest, NextResponse } from 'next/server'
import { withOrgWrite } from '@/lib/org-scope-guard'
import { generateSageExportPackageForScope } from '@/lib/sage/export-service'
import { GenerateExportPackageRequest } from '@/lib/sage/export-schemas'
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
    // Generation takes no body fields; validate strictly to reject smuggled data.
    let body: unknown = {}
    try {
      const text = await request.text()
      body = text ? JSON.parse(text) : {}
    } catch {
      return NextResponse.json(
        { ok: false, error: { code: 'INVALID_JSON', message: 'Body must be JSON' } },
        { status: 400 },
      )
    }
    const parsed = GenerateExportPackageRequest.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_FAILED', message: 'Invalid generate payload', details: parsed.error.flatten() } },
        { status: 400 },
      )
    }
    try {
      const result = await generateSageExportPackageForScope(ctx, workspaceId, requestId, { idempotencyKey })
      return NextResponse.json({ ok: true, data: result.response }, { status: result.replayed ? 200 : 201 })
    } catch (error) {
      return sageErrorResponse(error)
    }
  })
}

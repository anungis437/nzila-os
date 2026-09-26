/**
 * Platform Admin — SAGE institutional Q&A context API
 *
 * POST /api/sage/workspaces/[workspaceId]/institutional-context
 *
 * Mandated synthesis-safety choke for institutional continuity answers.
 * Body may include an optional claimRegister (CLEAR-side annotations mapped to
 * evidence ids) and a question string. Response JSON never includes evidence
 * or claims the principal cannot access.
 *
 * This is NOT a generative assistant — it returns authorized context + claim
 * provenance only. Staging deploy (B-005) still required for live demos.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withOrgScope } from '@/lib/org-scope-guard'
import { buildInstitutionalQaContextForScope } from '@/lib/sage/evidence-service'
import { sageErrorResponse, sageNotFoundResponse } from '@/lib/sage/route-helpers'
import { SAGE_AUTHORIZATION_LEVELS } from '@nzila/sage-core'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ClaimEntry = z
  .object({
    claimId: z.string().min(1).max(200),
    claim: z.string().min(1).max(2000),
    evidenceItemId: z.string().min(1).max(200),
    sourceId: z.string().min(1).max(200),
    occurredAt: z.string().min(1).max(64),
    authorityActorId: z.string().min(1).max(200),
    authorityRoleLabel: z.string().max(200).optional(),
    whatChanged: z.string().max(2000).optional(),
    whatUnresolved: z.string().max(2000).optional(),
    authorizationLevel: z.enum(SAGE_AUTHORIZATION_LEVELS),
    workspaceId: z.string().min(1).max(200),
    orgId: z.string().min(1).max(200),
  })
  .strict()

const RequestBody = z
  .object({
    question: z.string().max(2000).optional(),
    claimRegister: z.array(ClaimEntry).max(500).optional(),
    annotations: z
      .array(
        z
          .object({
            evidenceItemId: z.string().min(1).max(200),
            title: z.string().max(500).optional(),
            excerpt: z.string().max(4000).optional(),
          })
          .strict(),
      )
      .max(500)
      .optional(),
  })
  .strict()

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await context.params
  return withOrgScope(request, async (ctx) => {
    try {
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
      const raw = await request.json().catch(() => ({}))
      const parsed = RequestBody.safeParse(raw)
      if (!parsed.success) {
        return NextResponse.json(
          { ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid institutional-context payload' } },
          { status: 400 },
        )
      }
      const data = await buildInstitutionalQaContextForScope(ctx, workspaceId, {
        question: parsed.data.question,
        claimRegister: parsed.data.claimRegister,
        annotations: parsed.data.annotations,
      })
      if (!data) return sageNotFoundResponse()
      return NextResponse.json({ ok: true, data })
    } catch (error) {
      return sageErrorResponse(error)
    }
  })
}

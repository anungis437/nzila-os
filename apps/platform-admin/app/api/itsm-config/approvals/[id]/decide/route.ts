/**
 * Platform Admin — Decide on an ITSM Approval
 *
 * POST /api/itsm-config/approvals/[id]/decide
 * Body: { decision: 'approved' | 'rejected', decisionNote?: string }
 *
 * Only the assigned approver may decide. Idempotency-Key required.
 */
import { NextRequest, NextResponse } from 'next/server'
import { withOrgWrite } from '../../../../../../lib/org-scope-guard'
import {
  decideApproval,
  approvalDecisionSchema,
} from '../../../../../../lib/itsm-queries'
import { recordItsmAudit } from '../../../../../../lib/itsm-audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params
  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { ok: false, error: { code: 'INVALID_ID', message: 'Invalid approval id' } },
      { status: 400 },
    )
  }
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

  return withOrgWrite(request, async (orgCtx) => {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { ok: false, error: { code: 'INVALID_JSON', message: 'Body must be JSON' } },
        { status: 400 },
      )
    }
    const parsed = approvalDecisionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid approval decision',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 },
      )
    }

    const result = await decideApproval(orgCtx.orgId, id, orgCtx.actorId, parsed.data)

    if ('error' in result) {
      const errCode = result.error as 'NOT_FOUND' | 'NOT_APPROVER' | 'ALREADY_DECIDED'
      const map = {
        NOT_FOUND: { status: 404, message: 'Approval not found in org' },
        NOT_APPROVER: {
          status: 403,
          message: 'Only the assigned approver may decide this request',
        },
        ALREADY_DECIDED: {
          status: 409,
          message: `Approval already ${'status' in result ? result.status : 'decided'}`,
        },
      } as const
      const meta = map[errCode]
      return NextResponse.json(
        { ok: false, error: { code: errCode, message: meta.message } },
        { status: meta.status },
      )
    }

    await recordItsmAudit({
      orgId: orgCtx.orgId,
      actorId: orgCtx.actorId,
      actorRole: orgCtx.orgRole,
      actionType: `itsm.approval.${parsed.data.decision}`,
      resourceType: 'itsm_approval',
      resourceId: id,
      input: parsed.data,
      outcome: { id, status: result.updated?.status },
    })

    return NextResponse.json({ ok: true, data: result.updated })
  })
}

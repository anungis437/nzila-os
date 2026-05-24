/**
 * Platform Admin — ITSM SLA Profile (single) API
 *
 * PATCH  /api/itsm-config/sla-profiles/[id]   — update SLA profile
 * DELETE /api/itsm-config/sla-profiles/[id]   — delete (refuses if any queue uses it)
 */
import { NextRequest, NextResponse } from 'next/server'
import { withOrgWrite } from '../../../../../lib/org-scope-guard'
import {
  updateSlaProfile,
  deleteSlaProfile,
  updateSlaProfileSchema,
} from '../../../../../lib/itsm-queries'
import { recordItsmAudit } from '../../../../../lib/itsm-audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params
  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { ok: false, error: { code: 'INVALID_ID', message: 'Invalid SLA profile id' } },
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
    const parsed = updateSlaProfileSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid SLA profile patch',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 },
      )
    }
    const updated = await updateSlaProfile(orgCtx.orgId, id, parsed.data)
    if (!updated) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'SLA profile not found in org' } },
        { status: 404 },
      )
    }
    await recordItsmAudit({
      orgId: orgCtx.orgId,
      actorId: orgCtx.actorId,
      actorRole: orgCtx.orgRole,
      actionType: 'itsm.sla_profile.updated',
      resourceType: 'itsm_sla_profile',
      resourceId: updated.id,
      input: parsed.data,
      outcome: { id: updated.id, name: updated.name },
    })
    return NextResponse.json({ ok: true, data: updated })
  })
}

export async function DELETE(request: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params
  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { ok: false, error: { code: 'INVALID_ID', message: 'Invalid SLA profile id' } },
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
    const result = await deleteSlaProfile(orgCtx.orgId, id)
    if ('error' in result) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: result.error,
            message:
              'SLA profile is referenced by at least one queue. Reassign or delete those queues first.',
          },
        },
        { status: 409 },
      )
    }
    if (!result.deleted) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'SLA profile not found in org' } },
        { status: 404 },
      )
    }
    await recordItsmAudit({
      orgId: orgCtx.orgId,
      actorId: orgCtx.actorId,
      actorRole: orgCtx.orgRole,
      actionType: 'itsm.sla_profile.deleted',
      resourceType: 'itsm_sla_profile',
      resourceId: id,
      input: { id },
      outcome: { deleted: true },
    })
    return NextResponse.json({ ok: true, data: { deleted: id } })
  })
}

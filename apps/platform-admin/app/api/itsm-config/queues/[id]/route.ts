/**
 * Platform Admin — ITSM Queue (single) API
 *
 * PATCH  /api/itsm-config/queues/[id]   — update queue
 * DELETE /api/itsm-config/queues/[id]   — delete queue
 */
import { NextRequest, NextResponse } from 'next/server'
import { withOrgWrite } from '../../../../../lib/org-scope-guard'
import {
  updateQueue,
  deleteQueue,
  updateQueueSchema,
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
      { ok: false, error: { code: 'INVALID_ID', message: 'Invalid queue id' } },
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
    const parsed = updateQueueSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid queue patch',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 },
      )
    }

    const updated = await updateQueue(orgCtx.orgId, id, parsed.data)
    if (!updated) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Queue not found in org' } },
        { status: 404 },
      )
    }
    await recordItsmAudit({
      orgId: orgCtx.orgId,
      actorId: orgCtx.actorId,
      actorRole: orgCtx.orgRole,
      actionType: 'itsm.queue.updated',
      resourceType: 'itsm_queue',
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
      { ok: false, error: { code: 'INVALID_ID', message: 'Invalid queue id' } },
      { status: 400 },
    )
  }

  return withOrgWrite(request, async (orgCtx) => {
    const deleted = await deleteQueue(orgCtx.orgId, id)
    if (!deleted) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Queue not found in org' } },
        { status: 404 },
      )
    }
    await recordItsmAudit({
      orgId: orgCtx.orgId,
      actorId: orgCtx.actorId,
      actorRole: orgCtx.orgRole,
      actionType: 'itsm.queue.deleted',
      resourceType: 'itsm_queue',
      resourceId: id,
      input: { id },
      outcome: { deleted: true },
    })
    return NextResponse.json({ ok: true, data: { deleted: id } })
  })
}

/**
 * Platform Admin — ITSM Queues API
 *
 * GET  /api/itsm-config/queues             — list org's queues (+ open ticket counts)
 * POST /api/itsm-config/queues             — create a new queue (org_admin/secretary)
 *
 * All requests are org-scoped via `withOrgScope` / `withOrgWrite`.
 * Mutations are sealed into the NAR audit chain via `recordItsmAudit`.
 */
import { NextRequest, NextResponse } from 'next/server'
import {
  withOrgScope,
  withOrgWrite,
} from '../../../../lib/org-scope-guard'
import {
  listQueues,
  createQueue,
  createQueueSchema,
} from '../../../../lib/itsm-queries'
import { recordItsmAudit } from '../../../../lib/itsm-audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return withOrgScope(request, async (ctx) => {
    const queues = await listQueues(ctx.orgId)
    return NextResponse.json({ ok: true, data: queues })
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

    const parsed = createQueueSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid queue payload',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 },
      )
    }

    const row = await createQueue(ctx.orgId, parsed.data)
    await recordItsmAudit({
      orgId: ctx.orgId,
      actorId: ctx.actorId,
      actorRole: ctx.orgRole,
      actionType: 'itsm.queue.created',
      resourceType: 'itsm_queue',
      resourceId: row.id,
      input: parsed.data,
      outcome: { id: row.id, name: row.name },
    })

    return NextResponse.json({ ok: true, data: row }, { status: 201 })
  })
}

/**
 * Platform Admin — Automation Rule Item API
 *
 *   PATCH  /api/itsm-config/automation-rules/[id]   — update a rule
 *   DELETE /api/itsm-config/automation-rules/[id]   — delete a rule
 */
import { NextRequest, NextResponse } from 'next/server'
import { withOrgWrite } from '../../../../../lib/org-scope-guard'
import {
  deleteAutomationRule,
  updateAutomationRule,
  updateAutomationRuleSchema,
} from '../../../../../lib/automation-queries'
import { recordItsmAudit } from '../../../../../lib/itsm-audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function badId() {
  return NextResponse.json(
    { ok: false, error: { code: 'INVALID_ID', message: 'Invalid rule id' } },
    { status: 400 },
  )
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!UUID_RE.test(id)) return badId()

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
    const parsed = updateAutomationRuleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid automation rule payload',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 },
      )
    }

    const row = await updateAutomationRule(ctx.orgId, id, parsed.data)
    if (!row) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Rule not found' } },
        { status: 404 },
      )
    }
    await recordItsmAudit({
      orgId: ctx.orgId,
      actorId: ctx.actorId,
      actorRole: ctx.orgRole,
      actionType: 'itsm.automation_rule.updated',
      resourceType: 'itsm_automation_rule',
      resourceId: id,
      input: parsed.data,
      outcome: { id: row.id, name: row.name, enabled: row.enabled },
    })
    return NextResponse.json({ ok: true, data: row })
  })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!UUID_RE.test(id)) return badId()

  return withOrgWrite(request, async (ctx) => {
    const row = await deleteAutomationRule(ctx.orgId, id)
    if (!row) {
      return NextResponse.json(
        { ok: false, error: { code: 'NOT_FOUND', message: 'Rule not found' } },
        { status: 404 },
      )
    }
    await recordItsmAudit({
      orgId: ctx.orgId,
      actorId: ctx.actorId,
      actorRole: ctx.orgRole,
      actionType: 'itsm.automation_rule.deleted',
      resourceType: 'itsm_automation_rule',
      resourceId: id,
      input: {},
      outcome: { id },
    })
    return NextResponse.json({ ok: true, data: { id } })
  })
}

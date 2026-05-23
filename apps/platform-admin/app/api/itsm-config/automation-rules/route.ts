/**
 * Platform Admin — Automation Rules API
 *
 *   GET  /api/itsm-config/automation-rules        — list org rules
 *   POST /api/itsm-config/automation-rules        — create a rule (admin/secretary)
 */
import { NextRequest, NextResponse } from 'next/server'
import { withOrgScope, withOrgWrite } from '../../../../lib/org-scope-guard'
import {
  listAutomationRules,
  createAutomationRule,
  createAutomationRuleSchema,
} from '../../../../lib/automation-queries'
import { recordItsmAudit } from '../../../../lib/itsm-audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return withOrgScope(request, async (ctx) => {
    const rules = await listAutomationRules(ctx.orgId)
    return NextResponse.json({ ok: true, data: rules })
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
    const parsed = createAutomationRuleSchema.safeParse(body)
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

    const row = await createAutomationRule(ctx.orgId, parsed.data)
    await recordItsmAudit({
      orgId: ctx.orgId,
      actorId: ctx.actorId,
      actorRole: ctx.orgRole,
      actionType: 'itsm.automation_rule.created',
      resourceType: 'itsm_automation_rule',
      resourceId: row.id,
      input: parsed.data,
      outcome: { id: row.id, name: row.name, enabled: row.enabled },
    })
    return NextResponse.json({ ok: true, data: row }, { status: 201 })
  })
}

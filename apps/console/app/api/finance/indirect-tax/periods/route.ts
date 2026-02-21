// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Indirect Tax Periods
 * GET  /api/finance/indirect-tax/periods?entityId=...&accountId=...  → list periods
 * POST /api/finance/indirect-tax/periods                             → create period
 * PATCH /api/finance/indirect-tax/periods                            → update period
 *
 * PR5 — Entity-scoped auth + audit events
 */
import { NextRequest, NextResponse } from 'next/server'
import { platformDb } from '@nzila/db/platform'
import { indirectTaxPeriods } from '@nzila/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireEntityAccess } from '@/lib/api-guards'
import { CreateIndirectTaxPeriodInput } from '@nzila/tax/types'
import {
  recordFinanceAuditEvent,
  FINANCE_AUDIT_ACTIONS,
} from '@/lib/finance-audit'

export async function GET(req: NextRequest) {
  const entityId = req.nextUrl.searchParams.get('entityId')
  const accountId = req.nextUrl.searchParams.get('accountId')

  if (!entityId) {
    return NextResponse.json({ error: 'entityId required' }, { status: 400 })
  }

  const access = await requireEntityAccess(entityId)
  if (!access.ok) return access.response

  const conditions = accountId
    ? and(eq(indirectTaxPeriods.entityId, entityId), eq(indirectTaxPeriods.accountId, accountId))
    : eq(indirectTaxPeriods.entityId, entityId)

  const rows = await platformDb.select().from(indirectTaxPeriods).where(conditions)
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = CreateIndirectTaxPeriodInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const access = await requireEntityAccess(parsed.data.entityId, {
    minRole: 'entity_secretary',
  })
  if (!access.ok) return access.response

  const [row] = await platformDb
    .insert(indirectTaxPeriods)
    .values(parsed.data)
    .returning()

  await recordFinanceAuditEvent({
    entityId: parsed.data.entityId,
    actorClerkUserId: access.context.userId,
    actorRole: access.context.membership?.role ?? access.context.platformRole,
    action: FINANCE_AUDIT_ACTIONS.INDIRECT_TAX_PERIOD_CREATE,
    targetType: 'indirect_tax_period',
    targetId: row.id,
    afterJson: {
      taxType: parsed.data.taxType,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
    },
  })

  return NextResponse.json(row, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, ...updates } = body

  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  // Fetch existing to get entityId + previous status
  const [existing] = await platformDb
    .select()
    .from(indirectTaxPeriods)
    .where(eq(indirectTaxPeriods.id, id))

  if (!existing) {
    return NextResponse.json({ error: 'Period not found' }, { status: 404 })
  }

  const access = await requireEntityAccess(existing.entityId, {
    minRole: 'entity_secretary',
  })
  if (!access.ok) return access.response

  const [row] = await platformDb
    .update(indirectTaxPeriods)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(indirectTaxPeriods.id, id))
    .returning()

  // Pick audit action based on status transition
  const auditAction =
    updates.status === 'filed'
      ? FINANCE_AUDIT_ACTIONS.INDIRECT_TAX_PERIOD_FILE
      : updates.status === 'paid'
        ? FINANCE_AUDIT_ACTIONS.INDIRECT_TAX_PERIOD_PAY
        : FINANCE_AUDIT_ACTIONS.INDIRECT_TAX_PERIOD_CREATE

  await recordFinanceAuditEvent({
    entityId: existing.entityId,
    actorClerkUserId: access.context.userId,
    actorRole: access.context.membership?.role ?? access.context.platformRole,
    action: auditAction,
    targetType: 'indirect_tax_period',
    targetId: id,
    beforeJson: { status: existing.status },
    afterJson: updates as Record<string, unknown>,
  })

  return NextResponse.json(row)
}

// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Indirect Tax Period Detail
 * GET   /api/finance/indirect-tax/periods/[periodId]  → period detail + summary
 * PATCH /api/finance/indirect-tax/periods/[periodId]  → update period
 *
 * PR5 — Entity-scoped auth + audit events
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { platformDb } from '@nzila/db/platform'
import { indirectTaxPeriods, indirectTaxSummary, indirectTaxAccounts } from '@nzila/db/schema'
import { eq } from 'drizzle-orm'
import { requireEntityAccess } from '@/lib/api-guards'
import { buildIndirectTaxDeadlines } from '@nzila/tax/deadlines'
import {
  recordFinanceAuditEvent,
  FINANCE_AUDIT_ACTIONS,
} from '@/lib/finance-audit'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ periodId: string }> },
) {
  const { periodId } = await params

  const [[period], summaryRows] = await Promise.all([
    platformDb.select().from(indirectTaxPeriods).where(eq(indirectTaxPeriods.id, periodId)),
    platformDb.select().from(indirectTaxSummary).where(eq(indirectTaxSummary.periodId, periodId)),
  ])

  if (!period) {
    return NextResponse.json({ error: 'Period not found' }, { status: 404 })
  }

  const access = await requireEntityAccess(period.entityId)
  if (!access.ok) return access.response

  // Get account info
  const [account] = await platformDb
    .select()
    .from(indirectTaxAccounts)
    .where(eq(indirectTaxAccounts.id, period.accountId))

  const deadlines = buildIndirectTaxDeadlines({
    entityId: period.entityId,
    taxType: period.taxType,
    filingDue: period.filingDue,
    paymentDue: period.paymentDue,
    status: period.status,
  })

  return NextResponse.json({
    period,
    summary: summaryRows[0] ?? null,
    account: account ?? null,
    deadlines,
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ periodId: string }> },
) {
  const { periodId } = await params
  const IndirectTaxPeriodPatchSchema = z.object({
    status: z.enum(['open', 'filed', 'paid', 'closed']).optional(),
  })
  const bodyParsed = IndirectTaxPeriodPatchSchema.safeParse(await req.json())
  if (!bodyParsed.success) {
    return NextResponse.json({ error: bodyParsed.error.flatten() }, { status: 400 })
  }
  const body = bodyParsed.data

  // Fetch existing for entity scoping and previous state
  const [existing] = await platformDb
    .select()
    .from(indirectTaxPeriods)
    .where(eq(indirectTaxPeriods.id, periodId))

  if (!existing) {
    return NextResponse.json({ error: 'Period not found' }, { status: 404 })
  }

  const access = await requireEntityAccess(existing.entityId, {
    minRole: 'entity_secretary',
  })
  if (!access.ok) return access.response

  const [updated] = await platformDb
    .update(indirectTaxPeriods)
    .set({ ...(body.status !== undefined ? { status: body.status } : {}), updatedAt: new Date() })
    .where(eq(indirectTaxPeriods.id, periodId))
    .returning()

  const auditAction =
    body.status === 'filed'
      ? FINANCE_AUDIT_ACTIONS.INDIRECT_TAX_PERIOD_FILE
      : body.status === 'paid'
        ? FINANCE_AUDIT_ACTIONS.INDIRECT_TAX_PERIOD_PAY
        : FINANCE_AUDIT_ACTIONS.INDIRECT_TAX_PERIOD_CREATE

  await recordFinanceAuditEvent({
    entityId: existing.entityId,
    actorClerkUserId: access.context.userId,
    actorRole: access.context.membership?.role ?? access.context.platformRole,
    action: auditAction,
    targetType: 'indirect_tax_period',
    targetId: periodId,
    beforeJson: { status: existing.status },
    afterJson: body as Record<string, unknown>,
  })

  return NextResponse.json(updated)
}

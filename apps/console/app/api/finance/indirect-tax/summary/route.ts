// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Indirect Tax Summary
 * GET  /api/finance/indirect-tax/summary?periodId=...  → get summary for a period
 * POST /api/finance/indirect-tax/summary               → create/update summary
 *
 * PR5 — Entity-scoped auth + audit events
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@nzila/db'
import { indirectTaxSummary, indirectTaxPeriods } from '@nzila/db/schema'
import { eq } from 'drizzle-orm'
import { requireEntityAccess, authenticateUser } from '@/lib/api-guards'
import { UpdateIndirectTaxSummaryInput } from '@nzila/tax/types'
import {
  recordFinanceAuditEvent,
  FINANCE_AUDIT_ACTIONS,
} from '@/lib/finance-audit'

export async function GET(req: NextRequest) {
  const authResult = await authenticateUser()
  if (!authResult.ok) return authResult.response

  const periodId = req.nextUrl.searchParams.get('periodId')
  if (!periodId) {
    return NextResponse.json({ error: 'periodId required' }, { status: 400 })
  }

  const rows = await db
    .select()
    .from(indirectTaxSummary)
    .where(eq(indirectTaxSummary.periodId, periodId))

  return NextResponse.json(rows[0] ?? null)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = UpdateIndirectTaxSummaryInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Resolve entityId from the period
  const [period] = await db
    .select()
    .from(indirectTaxPeriods)
    .where(eq(indirectTaxPeriods.id, parsed.data.periodId))

  if (!period) {
    return NextResponse.json({ error: 'Period not found' }, { status: 404 })
  }

  const access = await requireEntityAccess(period.entityId, {
    minRole: 'entity_secretary',
  })
  if (!access.ok) return access.response

  // Upsert: check if summary already exists for this period
  const existing = await db
    .select()
    .from(indirectTaxSummary)
    .where(eq(indirectTaxSummary.periodId, parsed.data.periodId))

  let row
  if (existing.length > 0) {
    const { periodId, ...updates } = parsed.data
    ;[row] = await db
      .update(indirectTaxSummary)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(indirectTaxSummary.periodId, periodId))
      .returning()
  } else {
    ;[row] = await db
      .insert(indirectTaxSummary)
      .values(parsed.data)
      .returning()
  }

  await recordFinanceAuditEvent({
    entityId: period.entityId,
    actorClerkUserId: access.context.userId,
    actorRole: access.context.membership?.role ?? access.context.platformRole,
    action: FINANCE_AUDIT_ACTIONS.INDIRECT_TAX_SUMMARY_UPDATE,
    targetType: 'indirect_tax_summary',
    targetId: row.id,
    beforeJson: existing[0] ? (existing[0] as unknown as Record<string, unknown>) : undefined,
    afterJson: parsed.data as unknown as Record<string, unknown>,
  })

  return NextResponse.json(row, { status: existing.length > 0 ? 200 : 201 })
}

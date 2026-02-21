// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Close Periods
 * GET   /api/finance/close?entityId=...  → list close periods
 * POST  /api/finance/close               → create close period
 * PATCH /api/finance/close               → update close period status
 *
 * PR5 — Governance enforcement:
 *  • Entity-scoped auth via requireEntityAccess
 *  • Hash-chained audit events via recordFinanceAuditEvent
 *  • Close gate: all exceptions must be resolved before closing
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@nzila/db'
import { closePeriods, closeExceptions } from '@nzila/db/schema'
import { eq, and, ne } from 'drizzle-orm'
import { requireEntityAccess } from '@/lib/api-guards'
import {
  recordFinanceAuditEvent,
  FINANCE_AUDIT_ACTIONS,
} from '@/lib/finance-audit'

// ── Request schemas ──────────────────────────────────────────────────────────

const ClosePeriodPostSchema = z.object({
  entityId: z.string().min(1),
  periodLabel: z.string().min(1),
  periodType: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
})

const ClosePeriodPatchSchema = z.object({
  id: z.string().min(1),
  status: z.string().min(1),
  entityId: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const entityId = req.nextUrl.searchParams.get('entityId')
  if (!entityId) {
    return NextResponse.json({ error: 'entityId required' }, { status: 400 })
  }

  const access = await requireEntityAccess(entityId)
  if (!access.ok) return access.response

  const periods = await db
    .select()
    .from(closePeriods)
    .where(eq(closePeriods.entityId, entityId))

  return NextResponse.json(periods)
}

export async function POST(req: NextRequest) {
  const parsed = ClosePeriodPostSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { entityId, periodLabel, periodType, startDate, endDate } = parsed.data

  const access = await requireEntityAccess(entityId, { minRole: 'entity_secretary' })
  if (!access.ok) return access.response

  const [row] = await db
    .insert(closePeriods)
    .values({
      entityId,
      periodLabel,
      periodType,
      startDate,
      endDate,
      openedBy: access.context.userId,
    })
    .returning()

  // Audit: close period opened
  await recordFinanceAuditEvent({
    entityId,
    actorClerkUserId: access.context.userId,
    actorRole: access.context.membership?.role ?? access.context.platformRole,
    action: FINANCE_AUDIT_ACTIONS.CLOSE_PERIOD_OPEN,
    targetType: 'close_period',
    targetId: row.id,
    afterJson: { periodLabel, periodType, startDate, endDate },
  })

  return NextResponse.json(row, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const parsed = ClosePeriodPatchSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { id, status } = parsed.data

  // Fetch the period to know entityId and prior status
  const [existing] = await db
    .select()
    .from(closePeriods)
    .where(eq(closePeriods.id, id))

  if (!existing) {
    return NextResponse.json({ error: 'Close period not found' }, { status: 404 })
  }

  const access = await requireEntityAccess(existing.entityId, {
    minRole: 'entity_secretary',
  })
  if (!access.ok) return access.response

  // ── Governance gate: block close if unresolved exceptions ──
  if (status === 'closed') {
    const openExceptions = await db
      .select()
      .from(closeExceptions)
      .where(
        and(
          eq(closeExceptions.periodId, id),
          ne(closeExceptions.status, 'resolved'),
          ne(closeExceptions.status, 'waived'),
        ),
      )

    if (openExceptions.length > 0) {
      return NextResponse.json(
        {
          error: 'Cannot close period: unresolved exceptions exist.',
          openExceptions: openExceptions.length,
        },
        { status: 422 },
      )
    }
  }

  const previousStatus = existing.status

  const updates: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
  }

  if (status === 'closed') {
    updates.closedBy = access.context.userId
    updates.closedAt = new Date()
  }

  const [row] = await db
    .update(closePeriods)
    .set(updates)
    .where(eq(closePeriods.id, id))
    .returning()

  // Pick the right audit action based on status transition
  const auditAction =
    status === 'submitted'
      ? FINANCE_AUDIT_ACTIONS.CLOSE_PERIOD_SUBMIT
      : status === 'approved'
        ? FINANCE_AUDIT_ACTIONS.CLOSE_PERIOD_APPROVE
        : status === 'rejected'
          ? FINANCE_AUDIT_ACTIONS.CLOSE_PERIOD_REJECT
          : status === 'closed'
            ? FINANCE_AUDIT_ACTIONS.CLOSE_PERIOD_CLOSE
            : FINANCE_AUDIT_ACTIONS.CLOSE_PERIOD_OPEN

  await recordFinanceAuditEvent({
    entityId: existing.entityId,
    actorClerkUserId: access.context.userId,
    actorRole: access.context.membership?.role ?? access.context.platformRole,
    action: auditAction,
    targetType: 'close_period',
    targetId: id,
    beforeJson: { status: previousStatus },
    afterJson: { status },
  })

  return NextResponse.json(row)
}

import { platformDb } from '@nzila/db/platform'
import { closePeriods, closeTasks, closeExceptions, closeApprovals } from '@nzila/db/schema'
import { eq, and, ne } from 'drizzle-orm'
import type { AuthContext } from '@/lib/api-guards'
import { recordFinanceAuditEvent, FINANCE_AUDIT_ACTIONS } from '@/lib/finance-audit'
import { enforcePolicies } from '@/lib/policy-enforcement'
import { createLogger } from '@nzila/os-core'
const financeLogger = createLogger('api:finance:close')
export async function loadClosePeriod(id: string) {
  return (await platformDb.select().from(closePeriods).where(eq(closePeriods.id, id)).limit(1))[0]
}
async function computeBudgetUtilization(orgId: string): Promise<number> {
  const periods = await platformDb.select().from(closePeriods).where(eq(closePeriods.orgId, orgId))
  if (periods.length === 0) return 0
  const closed = periods.filter((p) => p.status === 'closed').length
  return Math.round((closed / periods.length) * 100)
}

export async function listClosePeriods(orgId: string) {
  const periods = await platformDb.select().from(closePeriods).where(eq(closePeriods.orgId, orgId))
  return {
    status: 200 as const,
    body: periods,
  }
}

export async function createClosePeriod(
  input: {
    orgId: string
    periodLabel: string
    periodType: string
    startDate: string
    endDate: string
  },
  actor: AuthContext,
) {
  const { orgId, periodLabel, periodType, startDate, endDate } = input
  // ── Policy enforcement gate ──────────────────────────────────────────
  const policyResult = await enforcePolicies({
    action: 'finance.close_period.create',
    resource: '/api/finance',
    actor: {
      userId: actor.userId,
      roles: [actor.membership?.role ?? actor.platformRole],
    },
    context: {
      periodType,
      budgetUtilization: await computeBudgetUtilization(orgId),
    },
    orgId,
    environment: process.env.NODE_ENV ?? 'development',
  })
  if (policyResult.blocked) {
    financeLogger.warn('Close period creation denied by policy', {
      userId: actor.userId,
      orgId,
      reason: policyResult.reason,
    })
    return {
      status: 403 as const,
      body: {
        error: 'Denied by financial policy',
        detail: policyResult.reason,
        policyEnforced: true,
      },
    }
  }
  if (policyResult.needsApproval) {
    financeLogger.info('Close period creation requires approval', {
      userId: actor.userId,
      orgId,
      approverRoles: policyResult.approverRoles,
    })
    return {
      status: 202 as const,
      body: {
        status: 'approval_required',
        approverRoles: policyResult.approverRoles,
        requiredApprovers: policyResult.requiredApprovers,
        policyEnforced: true,
      },
    }
  }
  const [row] = await platformDb
    .insert(closePeriods)
    .values({
      orgId,
      periodLabel,
      periodType,
      startDate,
      endDate,
      openedBy: actor.userId,
    })
    .returning()
  // Audit: close period opened
  await recordFinanceAuditEvent({
    orgId,
    actorClerkUserId: actor.userId,
    actorRole: actor.membership?.role ?? actor.platformRole,
    action: FINANCE_AUDIT_ACTIONS.CLOSE_PERIOD_OPEN,
    targetType: 'close_period',
    targetId: row.id,
    afterJson: { periodLabel, periodType, startDate, endDate },
  })
  return {
    status: 201 as const,
    body: row,
  }
}

export async function changeClosePeriodStatus(
  id: string,
  status: string,
  existing: typeof closePeriods.$inferSelect,
  actor: AuthContext,
) {
  // ── Governance gate: block close if unresolved exceptions ──
  if (status === 'closed') {
    const openExceptions = await platformDb
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
      return {
        status: 422 as const,
        body: {
          error: 'Cannot close period: unresolved exceptions exist.',
          openExceptions: openExceptions.length,
        },
      }
    }
  }
  const previousStatus = existing.status
  const updates: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
  }
  if (status === 'closed') {
    updates.closedBy = actor.userId
    updates.closedAt = new Date()
  }
  const [row] = await platformDb
    .update(closePeriods)
    .set(updates)
    .where(and(eq(closePeriods.id, id), eq(closePeriods.orgId, existing.orgId)))
    .returning()
  if (!row)
    return {
      status: 409 as const,
      body: { error: 'Period no longer matches organization' },
    }
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
    orgId: existing.orgId,
    actorClerkUserId: actor.userId,
    actorRole: actor.membership?.role ?? actor.platformRole,
    action: auditAction,
    targetType: 'close_period',
    targetId: id,
    beforeJson: { status: previousStatus },
    afterJson: { status },
  })
  return {
    status: 200 as const,
    body: row,
  }
}

export async function readClosePeriodDetail(period: typeof closePeriods.$inferSelect) {
  const periodId = period.id
  const [tasks, exceptions, approvals] = await Promise.all([
    platformDb.select().from(closeTasks).where(eq(closeTasks.periodId, periodId)),
    platformDb.select().from(closeExceptions).where(eq(closeExceptions.periodId, periodId)),
    platformDb.select().from(closeApprovals).where(eq(closeApprovals.periodId, periodId)),
  ])
  return {
    status: 200 as const,
    body: { period, tasks, exceptions, approvals },
  }
}

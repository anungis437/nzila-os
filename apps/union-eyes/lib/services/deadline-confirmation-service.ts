import { and, eq, sql } from 'drizzle-orm';
import { grievanceDeadlines } from '@/db/schema/domains/claims/workflows';
import { withRLSContext, type RLSTx } from '@/lib/db/with-rls-context';
import { MEMBER_VISIBLE_DEADLINE_TYPE } from '@/lib/cases/case-deadline-contract';
import { ApiError } from '@/lib/api/errors';
import { decideCase } from '@/lib/authority/store/route-adapter';
import { requireCaseFilingCapacity, requireKernelCaseAction } from '@/lib/cases/case-authorization';
import { scheduleGrievanceDeadlineReminders } from '@/lib/deadline-engine/reminder-scheduler';
import { isTerminalDeadlineStatus } from '@/lib/deadline-engine/deadline-semantics';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

import { deadlineInOrganization as inOrganization } from '@/lib/deadline-engine/deadline-scope';
import { endOfDayInZone } from '@/lib/deadline-engine/deadline-day';
import { loadOrganizationTimeZone } from '@/lib/deadline-engine/organization-time-zone';

export type DeadlineConfirmationStatus =
  | 'SYSTEM_CALCULATED'
  | 'HUMAN_CONFIRMED'
  | 'OVERRIDDEN'
  | 'SUPERSEDED';

type DeadlineActor = { organizationId: string; deadlineId: string; actorId: string };

/** The older confirmation URL shares the case-specific authority boundary with manual management. */
export async function authorizeDeadlineConfirmation(tx: RLSTx, params: DeadlineActor, allowTerminal = false) {
  const [current] = await tx.select({ grievanceId: grievanceDeadlines.grievanceId, status: grievanceDeadlines.status, deadlineType: grievanceDeadlines.deadlineType })
    .from(grievanceDeadlines)
    .where(and(eq(grievanceDeadlines.id, params.deadlineId), inOrganization(params.organizationId)))
    .limit(1).for('update');
  if (!current) return null;
  const actor = { organizationId: params.organizationId, userId: params.actorId };
  if ((await decideCase(tx, { ...actor, caseId: current.grievanceId, action: 'case:read' })).effect !== 'allow') return null;
  await requireCaseFilingCapacity(tx, actor, 'handler');
  await requireKernelCaseAction(tx, actor, current.grievanceId, 'case:read_internal');
  await requireKernelCaseAction(tx, actor, current.grievanceId, 'case:draft_action');
  if (current.deadlineType === MEMBER_VISIBLE_DEADLINE_TYPE && (await decideCase(tx, { ...actor, caseId: current.grievanceId, action: 'case:disclose_to_member' })).effect !== 'allow') throw ApiError.forbidden('Member disclosure authority required');
  if (!allowTerminal && (isTerminalDeadlineStatus(current.status) || ['met', 'waived', 'superseded'].includes(current.status))) throw ApiError.conflict('Deadline is already terminal');
  return current;
}

async function withManagedDeadline<T>(params: DeadlineActor, operation: (tx: RLSTx) => Promise<T>, allowTerminal = false): Promise<T | null> {
  return withRLSContext({ organizationId: params.organizationId }, async (tx) => {
    if (!(await authorizeDeadlineConfirmation(tx, params, allowTerminal))) return null;
    return operation(tx);
  });
}

async function retireDeadlineReminders(tx: RLSTx, params: DeadlineActor, reason: string) {
  await tx.execute(sql`UPDATE deadline_reminders SET status='cancelled', cancelled_reason=${reason}, lease_owner=NULL, lease_expires_at=NULL
    WHERE organization_id=${params.organizationId}::uuid AND source_table='grievance_deadlines'
      AND source_deadline_id=${params.deadlineId}::uuid AND status IN ('pending','claimed')`);
}

export async function confirmDeadline(params: {
  organizationId: string;
  deadlineId: string;
  actorId: string;
}) {
  const now = new Date();
  // Each change commits together with its audit record.
  return withManagedDeadline(params, async (tx) => {
    const [updated] = await tx
      .update(grievanceDeadlines)
      .set({
        confirmationStatus: 'HUMAN_CONFIRMED',
        confirmedAt: now,
        confirmedBy: params.actorId,
        updatedAt: now,
      })
      .where(and(eq(grievanceDeadlines.id, params.deadlineId), inOrganization(params.organizationId)))
      .returning();

    if (updated) {
      await auditDeadlineConfirmation(tx, 'deadline.confirmed', params, {
        deadlineId: updated.id,
        calculatedDueDate: updated.calculatedDueDate?.toISOString(),
        dueDate: updated.dueDate.toISOString(),
      });
    }

    return updated ?? null;
  });
}

/**
 * `overrideDueDate` is either an instant (a datetime somebody entered, kept as given) or a calendar day ("2026-03-04"), which
 * falls due at 23:59 that day in the organization's zone (lib/deadline-engine/deadline-day.ts).
 */
export async function overrideDeadline(params: {
  organizationId: string;
  deadlineId: string;
  actorId: string;
  overrideDueDate: Date | string;
  overrideReason: string;
}) {
  const now = new Date();
  return withManagedDeadline(params, async (tx) => {
    const overrideDueDate = typeof params.overrideDueDate === 'string'
      ? endOfDayInZone(params.overrideDueDate, (await loadOrganizationTimeZone(params.organizationId)).timeZone)
      : params.overrideDueDate;
    const [current] = await tx
      .select({
        id: grievanceDeadlines.id,
        dueDate: grievanceDeadlines.dueDate,
        calculatedDueDate: grievanceDeadlines.calculatedDueDate,
      })
      .from(grievanceDeadlines)
      .where(and(eq(grievanceDeadlines.id, params.deadlineId), inOrganization(params.organizationId)))
      .limit(1);
    if (!current) return null;

    const [updated] = await tx
      .update(grievanceDeadlines)
      .set({
        confirmationStatus: 'OVERRIDDEN',
        calculatedDueDate: current.calculatedDueDate ?? current.dueDate,
        overrideDueDate,
        overrideReason: params.overrideReason,
        overrideAt: now,
        overrideBy: params.actorId,
        dueDate: overrideDueDate,
        updatedAt: now,
      })
      .where(and(eq(grievanceDeadlines.id, params.deadlineId), inOrganization(params.organizationId)))
      .returning();

    if (updated) {
      await retireDeadlineReminders(tx, params, 'deadline_override');
      await scheduleGrievanceDeadlineReminders({ sourceDeadlineId: updated.id, grievanceId: updated.grievanceId, dueDate: updated.dueDate, reminderOffsetsInDays: updated.reminderDays?.length ? updated.reminderDays : [7, 3, 1], actor: { type: 'user', id: params.actorId } });
      await auditDeadlineConfirmation(tx, 'deadline.overridden', params, {
        deadlineId: updated.id,
        calculatedDueDate: updated.calculatedDueDate?.toISOString(),
        overrideDueDate: overrideDueDate.toISOString(),
        overrideReason: params.overrideReason,
      });
    }

    return updated ?? null;
  });
}

export async function supersedeDeadline(params: {
  organizationId: string;
  deadlineId: string;
  actorId: string;
}) {
  const now = new Date();
  return withManagedDeadline(params, async (tx) => {
    const [updated] = await tx
      .update(grievanceDeadlines)
      .set({
        confirmationStatus: 'SUPERSEDED',
        supersededAt: now,
        supersededBy: params.actorId,
        // I2 (deadline-semantics): a superseded deadline is terminal for every reader. A completed deadline keeps its
        // completion fact; anything else becomes cancelled.
        status: sql`case when ${grievanceDeadlines.status} = 'completed' then 'completed' else 'cancelled' end`,
        updatedAt: now,
      })
      .where(and(eq(grievanceDeadlines.id, params.deadlineId), inOrganization(params.organizationId)))
      .returning();

    if (updated) {
      await retireDeadlineReminders(tx, params, 'deadline_superseded');
      await auditDeadlineConfirmation(tx, 'deadline.superseded', params, {
        deadlineId: updated.id,
        calculatedDueDate: updated.calculatedDueDate?.toISOString(),
        dueDate: updated.dueDate.toISOString(),
      });
    }

    return updated ?? null;
  }, true);
}

async function auditDeadlineConfirmation(
  tx: RLSTx,
  action: string,
  params: { organizationId: string; actorId: string },
  details: Record<string, unknown>,
) {
  return persistAtomicAudit(tx, {
    userId: params.actorId,
    organizationId: params.organizationId,
    resourceType: 'grievance_deadlines',
    resourceId: String(details.deadlineId ?? ''),
    action,
    details,
  });
}

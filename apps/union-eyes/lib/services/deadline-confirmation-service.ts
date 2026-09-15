import { and, eq } from 'drizzle-orm';
import { db } from '@/db/db';
import { grievanceDeadlines } from '@/db/schema/domains/claims/workflows';
import { auditLog, AuditSeverity } from '@/lib/audit-logger';

export type DeadlineConfirmationStatus =
  | 'SYSTEM_CALCULATED'
  | 'HUMAN_CONFIRMED'
  | 'OVERRIDDEN'
  | 'SUPERSEDED';

export async function confirmDeadline(params: {
  organizationId: string;
  deadlineId: string;
  actorId: string;
}) {
  const now = new Date();
  const [updated] = await db
    .update(grievanceDeadlines)
    .set({
      confirmationStatus: 'HUMAN_CONFIRMED',
      confirmedAt: now,
      confirmedBy: params.actorId,
      updatedAt: now,
    })
    .where(eq(grievanceDeadlines.id, params.deadlineId))
    .returning();

  if (updated) {
    await auditDeadlineConfirmation('deadline.confirmed', params, {
      deadlineId: updated.id,
      calculatedDueDate: updated.calculatedDueDate?.toISOString(),
      dueDate: updated.dueDate.toISOString(),
    });
  }

  return updated ?? null;
}

export async function overrideDeadline(params: {
  organizationId: string;
  deadlineId: string;
  actorId: string;
  overrideDueDate: Date;
  overrideReason: string;
}) {
  const now = new Date();
  const [current] = await db
    .select({
      id: grievanceDeadlines.id,
      dueDate: grievanceDeadlines.dueDate,
      calculatedDueDate: grievanceDeadlines.calculatedDueDate,
    })
    .from(grievanceDeadlines)
    .where(eq(grievanceDeadlines.id, params.deadlineId))
    .limit(1);

  const [updated] = await db
    .update(grievanceDeadlines)
    .set({
      confirmationStatus: 'OVERRIDDEN',
      calculatedDueDate: current?.calculatedDueDate ?? current?.dueDate,
      overrideDueDate: params.overrideDueDate,
      overrideReason: params.overrideReason,
      overrideAt: now,
      overrideBy: params.actorId,
      dueDate: params.overrideDueDate,
      updatedAt: now,
    })
    .where(eq(grievanceDeadlines.id, params.deadlineId))
    .returning();

  if (updated) {
    await auditDeadlineConfirmation('deadline.overridden', params, {
      deadlineId: updated.id,
      calculatedDueDate: updated.calculatedDueDate?.toISOString(),
      overrideDueDate: params.overrideDueDate.toISOString(),
      overrideReason: params.overrideReason,
    });
  }

  return updated ?? null;
}

export async function supersedeDeadline(params: {
  organizationId: string;
  deadlineId: string;
  actorId: string;
}) {
  const now = new Date();
  const [updated] = await db
    .update(grievanceDeadlines)
    .set({
      confirmationStatus: 'SUPERSEDED',
      supersededAt: now,
      supersededBy: params.actorId,
      updatedAt: now,
    })
    .where(
      and(
        eq(grievanceDeadlines.id, params.deadlineId),
      ),
    )
    .returning();

  if (updated) {
    await auditDeadlineConfirmation('deadline.superseded', params, {
      deadlineId: updated.id,
      calculatedDueDate: updated.calculatedDueDate?.toISOString(),
      dueDate: updated.dueDate.toISOString(),
    });
  }

  return updated ?? null;
}

async function auditDeadlineConfirmation(
  eventType: string,
  params: { organizationId: string; actorId: string },
  details: Record<string, unknown>,
) {
  return auditLog({
    eventType,
    severity: AuditSeverity.MEDIUM,
    userId: params.actorId,
    organizationId: params.organizationId,
    resource: 'grievance_deadlines',
    resourceId: String(details.deadlineId ?? ''),
    action: eventType,
    details,
    outcome: 'success',
  });
}

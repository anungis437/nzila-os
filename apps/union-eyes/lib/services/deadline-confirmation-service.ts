import { and, eq, sql } from 'drizzle-orm';
import { grievanceDeadlines } from '@/db/schema/domains/claims/workflows';
import { withRLSContext, type RLSTx } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

// grievance_deadlines has no organization column of its own: it belongs to its grievance, so organization scope is the
// owning grievance's. Without this predicate a deadline id from another organization could be rewritten.
const inOrganization = (organizationId: string) =>
  sql`${grievanceDeadlines.grievanceId} IN (SELECT id FROM grievances WHERE organization_id = ${organizationId})`;

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
  // Each change commits together with its audit record.
  return withRLSContext({ organizationId: params.organizationId }, async (tx) => {
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

export async function overrideDeadline(params: {
  organizationId: string;
  deadlineId: string;
  actorId: string;
  overrideDueDate: Date;
  overrideReason: string;
}) {
  const now = new Date();
  return withRLSContext({ organizationId: params.organizationId }, async (tx) => {
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
        overrideDueDate: params.overrideDueDate,
        overrideReason: params.overrideReason,
        overrideAt: now,
        overrideBy: params.actorId,
        dueDate: params.overrideDueDate,
        updatedAt: now,
      })
      .where(and(eq(grievanceDeadlines.id, params.deadlineId), inOrganization(params.organizationId)))
      .returning();

    if (updated) {
      await auditDeadlineConfirmation(tx, 'deadline.overridden', params, {
        deadlineId: updated.id,
        calculatedDueDate: updated.calculatedDueDate?.toISOString(),
        overrideDueDate: params.overrideDueDate.toISOString(),
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
  return withRLSContext({ organizationId: params.organizationId }, async (tx) => {
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
      await auditDeadlineConfirmation(tx, 'deadline.superseded', params, {
        deadlineId: updated.id,
        calculatedDueDate: updated.calculatedDueDate?.toISOString(),
        dueDate: updated.dueDate.toISOString(),
      });
    }

    return updated ?? null;
  });
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

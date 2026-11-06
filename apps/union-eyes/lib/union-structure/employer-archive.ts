/**
 * Governed archive of an employer (DEF-0B6-EMP-REGISTRY-ARCHIVE-IGNORES-DEPENDENTS).
 *
 * Archiving takes an employer out of the registry: it takes no further payroll input (the timesheet route refuses an archived employer)
 * and drops off the employer list. The generic delete only set status = archived, whatever still depended on the employer. This action
 * locks the employer row, refuses with 409 while anything open still depends on it, and otherwise sets the status, stamps archivedAt and
 * updatedBy, and records the audit entry in the same transaction. Nothing is deleted.
 *
 * Open dependents (each must be finished, rejected, deactivated or moved first):
 *  - timesheet batches not yet rejected or processed (uploaded, normalizing, validated);
 *  - active employer contacts (isActive not false);
 *  - draft employer communications (not yet sent);
 *  - bargaining units still active or under certification;
 *  - worksites not archived or permanently closed.
 */
import { and, count, eq, inArray, notInArray, or, isNull } from 'drizzle-orm';
import type { RLSTx } from '@/lib/db/with-rls-context';
import { ApiError } from '@/lib/api/errors';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { bargainingUnits, employers, worksites } from '@/db/schema/union-structure-schema';
import { employerTimesheetBatches } from '@/db/schema/domains/employer-execution/employer-timesheets';
import { employerCommunications, employerContacts } from '@/db/schema/domains/communications/employer-communications';

export const OPEN_TIMESHEET_BATCH_STATUSES = ['uploaded', 'normalizing', 'validated'] as const;
export const LIVE_UNIT_STATUSES = ['active', 'under_certification'] as const;
export const CLOSED_WORKSITE_STATUSES = ['archived', 'permanently_closed'] as const;

export interface EmployerDependents {
  openTimesheetBatches: number;
  activeContacts: number;
  draftCommunications: number;
  liveBargainingUnits: number;
  openWorksites: number;
}

async function countOf(query: Promise<Array<{ n: number }>>): Promise<number> {
  const [row] = await query;
  return Number(row?.n ?? 0);
}

/** Counts what still depends on the employer, within the caller's organization. */
export async function employerOpenDependents(tx: RLSTx, organizationId: string, employerId: string): Promise<EmployerDependents> {
  return {
    openTimesheetBatches: await countOf(tx.select({ n: count() }).from(employerTimesheetBatches).where(and(
      eq(employerTimesheetBatches.organizationId, organizationId),
      eq(employerTimesheetBatches.employerId, employerId),
      inArray(employerTimesheetBatches.status, [...OPEN_TIMESHEET_BATCH_STATUSES]),
    ))),
    activeContacts: await countOf(tx.select({ n: count() }).from(employerContacts).where(and(
      eq(employerContacts.organizationId, organizationId),
      eq(employerContacts.employerId, employerId),
      or(isNull(employerContacts.isActive), eq(employerContacts.isActive, true)),
    ))),
    draftCommunications: await countOf(tx.select({ n: count() }).from(employerCommunications).where(and(
      eq(employerCommunications.organizationId, organizationId),
      eq(employerCommunications.employerId, employerId),
      eq(employerCommunications.status, 'draft'),
    ))),
    liveBargainingUnits: await countOf(tx.select({ n: count() }).from(bargainingUnits).where(and(
      eq(bargainingUnits.organizationId, organizationId),
      eq(bargainingUnits.employerId, employerId),
      inArray(bargainingUnits.status, [...LIVE_UNIT_STATUSES]),
    ))),
    openWorksites: await countOf(tx.select({ n: count() }).from(worksites).where(and(
      eq(worksites.organizationId, organizationId),
      eq(worksites.employerId, employerId),
      notInArray(worksites.status, [...CLOSED_WORKSITE_STATUSES]),
    ))),
  };
}

export async function archiveEmployerGoverned(
  tx: RLSTx,
  params: { organizationId: string; userId: string; employerId: string },
): Promise<typeof employers.$inferSelect> {
  const { organizationId, userId, employerId } = params;
  const [existing] = await tx
    .select()
    .from(employers)
    .where(and(eq(employers.id, employerId), eq(employers.organizationId, organizationId)))
    .limit(1)
    .for('update');
  if (!existing) throw ApiError.notFound('Employer not found');
  if (existing.status === 'archived') throw ApiError.conflict('The employer is already archived');

  const dependents = await employerOpenDependents(tx, organizationId, employerId);
  const open = Object.entries(dependents).filter(([, n]) => n > 0);
  if (open.length > 0) {
    throw ApiError.conflict('The employer still has open records; finish, reject, deactivate or move them before archiving', { dependents });
  }

  const now = new Date();
  const [archived] = await tx
    .update(employers)
    .set({ status: 'archived', archivedAt: now, updatedAt: now, updatedBy: userId })
    .where(and(eq(employers.id, employerId), eq(employers.organizationId, organizationId)))
    .returning();
  if (!archived) throw ApiError.notFound('Employer not found');

  await persistAtomicAudit(tx, {
    organizationId,
    userId,
    action: 'employer.archive',
    resourceType: 'employers',
    resourceId: employerId,
    details: { previousStatus: existing.status, fields: ['status', 'archivedAt'], route: 'employers.archive' },
  });
  return archived;
}

/**
 * Union Eyes Deadline Engine — assignment-driven recipient refresh
 *
 * Reminder recipients are snapshotted at schedule time and never
 * re-resolved at delivery (see recipient-resolver.ts). That is safe for
 * ordinary rescheduling, but it means a grievance reassignment (change of
 * `unionRepId`) leaves already-scheduled reminders pointed at the OUTGOING
 * representative unless something explicitly re-schedules them.
 *
 * refreshDeadlineRemindersForGrievance() is that explicit trigger. Callers
 * (currently: PATCH /api/grievances/[id]/assign) invoke it AFTER the
 * grievance row's unionRepId has been updated, so recipient re-resolution
 * reads the NEW assignment.
 */
import { eq, and, ne } from 'drizzle-orm';
import { db } from '@/db';
import { grievanceDeadlines } from '@/db/schema';
import { logger } from '@/lib/logger';
import { scheduleGrievanceDeadlineReminders } from './reminder-scheduler';
import { writeDeadlineAuditEvent } from './audit';

export interface RefreshDeadlineRemindersInput {
  grievanceId: string;
  organizationId: string;
  correlationId: string;
  actor: { type: 'user' | 'system' | 'worker'; id: string | null };
  /** Free-form reason recorded on the refresh audit event (e.g. 'assignment_changed'). */
  reason: string;
  previousAssigneeId?: string | null;
  newAssigneeId?: string | null;
}

export interface RefreshDeadlineRemindersResult {
  correlationId: string;
  refreshedDeadlineIds: string[];
  failedDeadlineIds: Array<{ deadlineId: string; error: string }>;
}

const DEFAULT_REMINDER_OFFSETS = [7, 3, 1];

/**
 * Reschedule reminders for every non-completed deadline belonging to a
 * grievance, so the recipient snapshot reflects the CURRENT assignment.
 * Resolves only deadlines belonging to the same grievance (org ownership
 * is the caller's responsibility — see the assign route, which already
 * verifies the grievance belongs to the authenticated organization before
 * calling this).
 */
export async function refreshDeadlineRemindersForGrievance(
  input: RefreshDeadlineRemindersInput,
): Promise<RefreshDeadlineRemindersResult> {
  const activeDeadlines = await db
    .select({
      id: grievanceDeadlines.id,
      dueDate: grievanceDeadlines.dueDate,
      reminderDays: grievanceDeadlines.reminderDays,
    })
    .from(grievanceDeadlines)
    .where(
      and(
        eq(grievanceDeadlines.grievanceId, input.grievanceId),
        ne(grievanceDeadlines.status, 'completed'),
      ),
    );

  const refreshedDeadlineIds: string[] = [];
  const failedDeadlineIds: Array<{ deadlineId: string; error: string }> = [];

  for (const deadline of activeDeadlines) {
    try {
      await scheduleGrievanceDeadlineReminders({
        sourceDeadlineId: deadline.id,
        grievanceId: input.grievanceId,
        dueDate: new Date(deadline.dueDate),
        reminderOffsetsInDays: deadline.reminderDays && deadline.reminderDays.length > 0
          ? deadline.reminderDays
          : DEFAULT_REMINDER_OFFSETS,
        correlationId: input.correlationId,
        actor: input.actor,
      });

      await writeDeadlineAuditEvent({
        organizationId: input.organizationId,
        sourceTable: 'grievance_deadlines',
        sourceDeadlineId: deadline.id,
        eventType: 'reminder.recipients_refreshed',
        actorType: input.actor.type,
        actorId: input.actor.id,
        correlationId: input.correlationId,
        metadata: {
          reason: input.reason,
          previous_assignee_id: input.previousAssigneeId ?? null,
          new_assignee_id: input.newAssigneeId ?? null,
        },
      });

      refreshedDeadlineIds.push(deadline.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failedDeadlineIds.push({ deadlineId: deadline.id, error: message });
      logger.error('deadline-engine.assignment-sync: failed to refresh reminders for deadline', {
        correlationId: input.correlationId,
        grievanceId: input.grievanceId,
        deadlineId: deadline.id,
        error: message,
      });
    }
  }

  logger.info('deadline-engine.assignment-sync: refresh complete', {
    correlationId: input.correlationId,
    grievanceId: input.grievanceId,
    refreshedCount: refreshedDeadlineIds.length,
    failedCount: failedDeadlineIds.length,
  });

  if (failedDeadlineIds.length > 0) {
    throw new Error(
      `deadline-engine.assignment-sync: failed to refresh reminders for ${failedDeadlineIds.length} of ${activeDeadlines.length} deadline(s) on grievance ${input.grievanceId}`,
    );
  }

  return { correlationId: input.correlationId, refreshedDeadlineIds, failedDeadlineIds };
}

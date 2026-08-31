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
import { eq, and, ne, sql } from 'drizzle-orm';
import { db } from '@/db';
import { grievanceDeadlines, deadlineReassignmentConvergence } from '@/db/schema';
import { logger } from '@/lib/logger';
import { scheduleGrievanceDeadlineReminders } from './reminder-scheduler';
import { writeDeadlineAuditEvent } from './audit';

/** Loosely typed so callers can pass either the module-level `db` or a transaction handle (e.g. from withRLSContext). */
type DbOrTx = typeof db;

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

// ---------------------------------------------------------------------------
// Durable convergence tasks
//
// refreshDeadlineRemindersForGrievance() above is a best-effort, in-request
// attempt: if deadline N of M fails, it throws, but nothing durable records
// that the grievance still needs convergence — a route-level 500 loses the
// information entirely. The functions below make the handoff durable: a
// deadline_reassignment_convergence row is inserted in the SAME transaction
// as the grievance assignment update (requestAssignmentConvergence), so an
// assignment can never commit without a retryable task existing. The task
// stays 'pending' (never a terminal failure) until every active deadline has
// converged, and re-processing it is safe to repeat any number of times.
// ---------------------------------------------------------------------------

export interface RequestAssignmentConvergenceInput {
  organizationId: string;
  grievanceId: string;
  correlationId: string;
  previousAssigneeId?: string | null;
  newAssigneeId: string;
}

/**
 * Insert a durable convergence task. Callers MUST pass the transaction
 * handle they used for the grievance assignment update (e.g. the `tx`
 * argument from `withRLSContext`) so the task's existence is atomic with
 * the assignment change — an assignment can never commit without a
 * corresponding pending convergence task.
 */
export async function requestAssignmentConvergence(
  tx: DbOrTx,
  input: RequestAssignmentConvergenceInput,
): Promise<{ taskId: string }> {
  const [row] = await tx
    .insert(deadlineReassignmentConvergence)
    .values({
      organizationId: input.organizationId,
      grievanceId: input.grievanceId,
      previousAssigneeId: input.previousAssigneeId ?? null,
      newAssigneeId: input.newAssigneeId,
      status: 'pending',
      correlationId: input.correlationId,
    })
    .returning({ id: deadlineReassignmentConvergence.id });

  if (!row) {
    throw new Error(
      `deadline-engine.assignment-sync: failed to insert convergence task for grievance ${input.grievanceId}`,
    );
  }
  return { taskId: row.id };
}

export interface ProcessAssignmentConvergenceResult {
  taskId: string;
  converged: boolean;
  refreshedDeadlineIds: string[];
}

/**
 * Idempotent attempt to converge a pending task: reschedules reminders for
 * every active deadline on the task's grievance against the recorded new
 * assignment. Safe to call any number of times — scheduleGrievance-
 * DeadlineReminders' cancel-then-insert is idempotent, so re-running an
 * already-converged deadline produces no duplicates. On failure the task
 * row is left 'pending' with the error recorded (never a terminal state),
 * so a later sweep can retry; on full success it is marked 'converged'.
 */
export async function processAssignmentConvergence(
  taskId: string,
  actor: { type: 'user' | 'system' | 'worker'; id: string | null } = { type: 'worker', id: null },
): Promise<ProcessAssignmentConvergenceResult> {
  const [task] = await db
    .select()
    .from(deadlineReassignmentConvergence)
    .where(eq(deadlineReassignmentConvergence.id, taskId));

  if (!task) {
    throw new Error(`deadline-engine.assignment-sync: convergence task ${taskId} not found`);
  }

  if (task.status === 'converged') {
    // Already converged — idempotent no-op, not an error.
    return { taskId, converged: true, refreshedDeadlineIds: [] };
  }

  try {
    const result = await refreshDeadlineRemindersForGrievance({
      grievanceId: task.grievanceId,
      organizationId: task.organizationId,
      correlationId: task.correlationId,
      actor,
      reason: 'assignment_changed',
      previousAssigneeId: task.previousAssigneeId,
      newAssigneeId: task.newAssigneeId,
    });

    await db
      .update(deadlineReassignmentConvergence)
      .set({
        status: 'converged',
        attemptCount: sql`${deadlineReassignmentConvergence.attemptCount} + 1`,
        lastAttemptedAt: new Date(),
        convergedAt: new Date(),
        lastError: null,
      })
      .where(eq(deadlineReassignmentConvergence.id, taskId));

    return { taskId, converged: true, refreshedDeadlineIds: result.refreshedDeadlineIds };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .update(deadlineReassignmentConvergence)
      .set({
        // Deliberately NOT 'failed' — this stays retryable so a sweep converges it later.
        status: 'pending',
        attemptCount: sql`${deadlineReassignmentConvergence.attemptCount} + 1`,
        lastAttemptedAt: new Date(),
        lastError: message,
      })
      .where(eq(deadlineReassignmentConvergence.id, taskId));

    logger.error('deadline-engine.assignment-sync: convergence attempt failed, remains pending for retry', {
      taskId,
      grievanceId: task.grievanceId,
      correlationId: task.correlationId,
      error: message,
    });
    throw error;
  }
}

export interface SweepPendingConvergenceResult {
  examined: number;
  converged: number;
  stillPending: number;
}

/**
 * Retry every pending convergence task, up to `maxTasks`. Called by the
 * reminder worker's periodic run so a handoff that failed mid-request (and
 * was never retried by a human re-hitting the assign endpoint) still
 * converges automatically. Never throws — each task's failure is isolated
 * and logged; the task simply remains pending for the next sweep.
 */
export async function sweepPendingAssignmentConvergence(
  actor: { type: 'user' | 'system' | 'worker'; id: string | null } = { type: 'worker', id: null },
  opts?: { maxTasks?: number },
): Promise<SweepPendingConvergenceResult> {
  const maxTasks = opts?.maxTasks ?? 50;
  const pending = await db
    .select({ id: deadlineReassignmentConvergence.id })
    .from(deadlineReassignmentConvergence)
    .where(eq(deadlineReassignmentConvergence.status, 'pending'))
    .limit(maxTasks);

  let converged = 0;
  for (const t of pending) {
    try {
      await processAssignmentConvergence(t.id, actor);
      converged++;
    } catch {
      // Already logged inside processAssignmentConvergence; task stays pending.
    }
  }

  return { examined: pending.length, converged, stillPending: pending.length - converged };
}

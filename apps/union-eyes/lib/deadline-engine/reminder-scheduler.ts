/**
 * Union Eyes Deadline Engine — reminder scheduler
 *
 * Creates durable reminder rows in `deadline_reminders`, one per
 * (recipient × offset). Callers use scheduleGrievanceDeadlineReminders()
 * when a deadline is created, rescheduled, or its recipient set changes.
 *
 * Atomicity guarantees:
 *  - Cancel-and-insert happens in a SINGLE SERIALIZABLE transaction. If it
 *    aborts, no partial reminders exist.
 *  - Rescheduling relies on the pending-uniqueness partial index
 *    (see migrations/0045_union_eyes_deadline_engine.sql). If two
 *    concurrent schedules race, exactly one wins.
 *  - The scheduler emits `reminder.scheduled` / `reminder.cancelled_reschedule`
 *    audit events for every reminder row it touches — no silent side effects.
 */
import { createHash, randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { logger } from '@/lib/logger';
import { writeDeadlineAuditEvent } from './audit';
import { resolveGrievanceDeadlineRecipients } from './recipient-resolver';
import type { DeadlineReminderKind, RecipientSnapshot } from './types';

export interface ScheduleGrievanceRemindersInput {
  sourceDeadlineId: string;
  grievanceId: string;
  dueDate: Date;
  reminderOffsetsInDays: number[];
  timezone?: string;
  correlationId?: string;
  actor?: { type: 'user' | 'system' | 'worker'; id: string | null };
  reminderKind?: DeadlineReminderKind;
}

export interface ScheduleGrievanceRemindersResult {
  correlationId: string;
  organizationId: string;
  scheduled: Array<{
    id: string;
    scheduledFor: string;
    offsetDays: number;
    recipientRole: string;
    recipientEmailHash: string;
  }>;
  cancelledForReschedule: string[];
  skipped: Array<{ role: string; reason: string }>;
  skippedInPast: Array<{ offsetDays: number; scheduledFor: string }>;
}

/**
 * Compute the scheduled_for timestamp for a reminder N days before dueDate.
 * We compute in UTC then let PostgreSQL interpret the offset — no timezone
 * arithmetic in Node beyond a simple ms subtraction. Callers that need
 * calendar-aware offsets (e.g. "3 business days before, at 08:00 local")
 * MUST expand that into an explicit UTC Date before calling.
 */
function computeScheduledFor(dueDate: Date, offsetDays: number): Date {
  const ms = dueDate.getTime() - offsetDays * 24 * 60 * 60 * 1000;
  return new Date(ms);
}

function hashEmail(email: string): string {
  return createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}

/**
 * Schedule reminders for a grievance deadline. Callers MUST invoke this
 * again if the deadline is rescheduled — this function will cancel the
 * old pending rows atomically.
 */
export async function scheduleGrievanceDeadlineReminders(
  input: ScheduleGrievanceRemindersInput,
): Promise<ScheduleGrievanceRemindersResult> {
  const correlationId = input.correlationId ?? randomUUID();
  const actor = input.actor ?? { type: 'system', id: null };
  const timezone = input.timezone ?? 'UTC';
  const reminderKind: DeadlineReminderKind = input.reminderKind ?? 'upcoming';

  if (input.reminderOffsetsInDays.length === 0) {
    throw new Error('deadline-engine.scheduler: reminderOffsetsInDays must be non-empty');
  }

  // 1. Recipient resolution (outside the txn — read-only).
  const resolution = await resolveGrievanceDeadlineRecipients({
    sourceTable: 'grievance_deadlines',
    sourceDeadlineId: input.sourceDeadlineId,
    grievanceId: input.grievanceId,
    correlationId,
  });

  if (resolution.recipients.length === 0) {
    logger.warn('deadline-engine.scheduler: no recipients resolved; nothing scheduled', {
      correlationId,
      sourceDeadlineId: input.sourceDeadlineId,
      grievanceId: input.grievanceId,
    });
    await writeDeadlineAuditEvent({
      organizationId: resolution.organizationId,
      sourceTable: 'grievance_deadlines',
      sourceDeadlineId: input.sourceDeadlineId,
      eventType: 'deadline.created',
      actorType: actor.type,
      actorId: actor.id,
      correlationId,
      metadata: {
        outcome: 'no_recipients',
        skipped_count: resolution.skipped.length,
      },
    });
    return {
      correlationId,
      organizationId: resolution.organizationId,
      scheduled: [],
      cancelledForReschedule: [],
      skipped: resolution.skipped,
      skippedInPast: [],
    };
  }

  const now = new Date();
  const skippedInPast: Array<{ offsetDays: number; scheduledFor: string }> = [];

  // 2. Compute the planned reminder rows.
  const planned = input.reminderOffsetsInDays.flatMap((offsetDays) => {
    const scheduledFor = computeScheduledFor(input.dueDate, offsetDays);
    if (scheduledFor.getTime() < now.getTime()) {
      skippedInPast.push({
        offsetDays,
        scheduledFor: scheduledFor.toISOString(),
      });
      return [] as Array<{ offsetDays: number; scheduledFor: Date; recipient: RecipientSnapshot }>;
    }
    return resolution.recipients.map((recipient) => ({
      offsetDays,
      scheduledFor,
      recipient,
    }));
  });

  // 3. Atomic cancel-then-insert.
  const scheduled: ScheduleGrievanceRemindersResult['scheduled'] = [];
  const cancelledIds: string[] = [];

  await db.transaction(async (tx) => {
    // Cancel prior pending rows for this deadline (rescheduling semantics).
    const cancelResult = await tx.execute(sql`
      update deadline_reminders
         set status = 'cancelled',
             cancelled_reason = 'rescheduled',
             lease_owner = null,
             lease_expires_at = null
       where source_deadline_id = ${input.sourceDeadlineId}::uuid
         and status = 'pending'
       returning id
    `);
    for (const row of cancelResult as unknown as Array<{ id: string }>) {
      cancelledIds.push(row.id);
    }

    for (const p of planned) {
      const emailHash = hashEmail(p.recipient.email);
      const inserted = await tx.execute(sql`
        insert into deadline_reminders (
          source_table, source_deadline_id, organization_id,
          offset_days, scheduled_for, timezone, reminder_kind,
          recipient_user_id, recipient_role, recipient_email,
          recipient_email_hash, recipient_locale
        ) values (
          'grievance_deadlines',
          ${input.sourceDeadlineId}::uuid,
          ${resolution.organizationId}::uuid,
          ${p.offsetDays},
          ${p.scheduledFor.toISOString()}::timestamptz,
          ${timezone},
          ${reminderKind},
          ${p.recipient.userId},
          ${p.recipient.role},
          ${p.recipient.email},
          ${emailHash},
          ${p.recipient.locale}
        )
        on conflict on constraint deadline_reminders_pending_uidx
        do nothing
        returning id, scheduled_for, offset_days, recipient_role, recipient_email_hash
      `);

      for (const row of inserted as unknown as Array<{
        id: string;
        scheduled_for: string | Date;
        offset_days: number;
        recipient_role: string;
        recipient_email_hash: string;
      }>) {
        scheduled.push({
          id: row.id,
          scheduledFor:
            row.scheduled_for instanceof Date
              ? row.scheduled_for.toISOString()
              : String(row.scheduled_for),
          offsetDays: row.offset_days,
          recipientRole: row.recipient_role,
          recipientEmailHash: row.recipient_email_hash,
        });
      }
    }
  });

  // 4. Audit events — one per cancellation, one per new schedule, plus
  //    a summary deadline.created / deadline.rescheduled event.
  for (const id of cancelledIds) {
    await writeDeadlineAuditEvent({
      organizationId: resolution.organizationId,
      sourceTable: 'grievance_deadlines',
      sourceDeadlineId: input.sourceDeadlineId,
      reminderId: id,
      eventType: 'reminder.cancelled_reschedule',
      actorType: actor.type,
      actorId: actor.id,
      correlationId,
      metadata: { reason: 'rescheduled' },
    });
  }

  for (const s of scheduled) {
    await writeDeadlineAuditEvent({
      organizationId: resolution.organizationId,
      sourceTable: 'grievance_deadlines',
      sourceDeadlineId: input.sourceDeadlineId,
      reminderId: s.id,
      eventType: 'reminder.scheduled',
      actorType: actor.type,
      actorId: actor.id,
      correlationId,
      metadata: {
        offset_days: s.offsetDays,
        scheduled_for: s.scheduledFor,
        recipient_role: s.recipientRole,
        recipient_email_hash: s.recipientEmailHash,
      },
    });
  }

  await writeDeadlineAuditEvent({
    organizationId: resolution.organizationId,
    sourceTable: 'grievance_deadlines',
    sourceDeadlineId: input.sourceDeadlineId,
    eventType: cancelledIds.length > 0 ? 'deadline.rescheduled' : 'deadline.created',
    actorType: actor.type,
    actorId: actor.id,
    correlationId,
    metadata: {
      due_date: input.dueDate.toISOString(),
      timezone,
      reminder_kind: reminderKind,
      scheduled_count: scheduled.length,
      cancelled_count: cancelledIds.length,
      skipped_in_past_count: skippedInPast.length,
      recipient_count: resolution.recipients.length,
    },
  });

  logger.info('deadline-engine.scheduler: scheduling complete', {
    correlationId,
    sourceDeadlineId: input.sourceDeadlineId,
    scheduledCount: scheduled.length,
    cancelledCount: cancelledIds.length,
    skippedRecipientCount: resolution.skipped.length,
    skippedInPastCount: skippedInPast.length,
  });

  return {
    correlationId,
    organizationId: resolution.organizationId,
    scheduled,
    cancelledForReschedule: cancelledIds,
    skipped: resolution.skipped,
    skippedInPast,
  };
}

/**
 * Cancel all pending reminders for a deadline (e.g. deadline completed or
 * withdrawn). Emits `deadline.completed` / `deadline.cancelled` events and
 * `reminder.cancelled_reschedule` for each row.
 */
export async function cancelGrievanceDeadlineReminders(input: {
  sourceDeadlineId: string;
  organizationId: string;
  reason: 'completed' | 'cancelled';
  correlationId?: string;
  actor?: { type: 'user' | 'system' | 'worker'; id: string | null };
}): Promise<{ cancelledIds: string[]; correlationId: string }> {
  const correlationId = input.correlationId ?? randomUUID();
  const actor = input.actor ?? { type: 'system', id: null };

  const cancelledIds: string[] = [];
  await db.transaction(async (tx) => {
    const cancelResult = await tx.execute(sql`
      update deadline_reminders
         set status = 'cancelled',
             cancelled_reason = ${input.reason},
             lease_owner = null,
             lease_expires_at = null
       where source_deadline_id = ${input.sourceDeadlineId}::uuid
         and status = 'pending'
       returning id
    `);
    for (const row of cancelResult as unknown as Array<{ id: string }>) {
      cancelledIds.push(row.id);
    }
  });

  for (const id of cancelledIds) {
    await writeDeadlineAuditEvent({
      organizationId: input.organizationId,
      sourceTable: 'grievance_deadlines',
      sourceDeadlineId: input.sourceDeadlineId,
      reminderId: id,
      eventType: 'reminder.cancelled_reschedule',
      actorType: actor.type,
      actorId: actor.id,
      correlationId,
      metadata: { reason: input.reason },
    });
  }

  await writeDeadlineAuditEvent({
    organizationId: input.organizationId,
    sourceTable: 'grievance_deadlines',
    sourceDeadlineId: input.sourceDeadlineId,
    eventType: input.reason === 'completed' ? 'deadline.completed' : 'deadline.cancelled',
    actorType: actor.type,
    actorId: actor.id,
    correlationId,
    metadata: { cancelled_reminder_count: cancelledIds.length },
  });

  return { cancelledIds, correlationId };
}

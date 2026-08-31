/**
 * Union Eyes Deadline Engine — reminder worker
 *
 * At-least-once delivery worker with lease/fence pattern (mirrors the
 * proven sage_notification_outbox worker in packages/sage-core).
 *
 * Contract:
 *  - Claims up to `maxBatch` pending reminders whose scheduled_for <= now,
 *    using FOR UPDATE SKIP LOCKED so multiple workers can run in parallel.
 *  - Also recovers claimed rows whose lease has expired (indicating a
 *    crashed prior worker) — these return to 'claimed' under the current
 *    worker with attempt_count preserved.
 *  - Attempts delivery, writes an immutable execution row, then transitions
 *    the reminder to sent | failed | dead_letter based on outcome and
 *    remaining attempts.
 *  - Emits `reminder.*` audit events for every state change.
 *  - Returns a structured WorkerRunResult (never a boolean, never a
 *    plain-text success message).
 */
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { logger } from '@/lib/logger';
import { writeDeadlineAuditEvent } from './audit';
import { deliverDeadlineReminderEmail } from './email-adapter';
import { sweepPendingAssignmentConvergence } from './assignment-sync';
import type { WorkerRunResult } from './types';

export interface RunReminderWorkerConfig {
  workerInstance?: string;
  maxBatch?: number;
  leaseMs?: number;
  claimUrlBuilder?: (row: ClaimedReminderRow, grievanceId: string | null) => string;
  now?: () => Date;
}

interface ClaimedReminderRow {
  id: string;
  source_deadline_id: string;
  organization_id: string;
  recipient_user_id: string | null;
  recipient_role: string;
  recipient_email: string;
  recipient_locale: string;
  message_subject: string;
  reminder_kind: string;
  offset_days: number;
  scheduled_for: string;
  attempt_count: number;
  max_attempts: number;
}

interface DispatchRevalidation {
  reminder_status: string;
  deadline_status: string | null;
  grievance_id: string | null;
  current_union_rep_id: string | null;
}

const DEFAULTS = {
  maxBatch: 25,
  leaseMs: 60_000, // 60 seconds — must exceed dispatch time + provider timeout.
};

function isoDaysBetween(then: Date, now: Date): number {
  const diffMs = then.getTime() - now.getTime();
  return Math.round(diffMs / (24 * 60 * 60 * 1000));
}

export async function runDeadlineReminderWorker(
  config: RunReminderWorkerConfig = {},
): Promise<WorkerRunResult> {
  const runId = randomUUID();
  const workerInstance =
    config.workerInstance ?? process.env.HOSTNAME ?? `deadline-worker-${runId.slice(0, 8)}`;
  const clock = config.now ?? (() => new Date());
  const startedAt = clock();
  const nowIso = startedAt.toISOString();
  const maxBatch = config.maxBatch ?? DEFAULTS.maxBatch;
  const leaseMs = config.leaseMs ?? DEFAULTS.leaseMs;
  const claimUrlBuilder =
    config.claimUrlBuilder ??
    ((row: ClaimedReminderRow, grievanceId: string | null) =>
      `${process.env.NEXT_PUBLIC_APP_URL || 'https://unioneyes.app'}/dashboard/grievances/${grievanceId ?? row.source_deadline_id}`);

  logger.info('deadline-engine.worker: run starting', {
    runId,
    workerInstance,
    maxBatch,
    leaseMs,
    nowIso,
  });

  // Retry any assignment-reassignment handoffs that failed to fully
  // converge in-request (see assignment-sync.ts). Never throws — a task
  // that still fails here simply remains pending for the next run.
  const convergenceSweep = await sweepPendingAssignmentConvergence({
    type: 'worker',
    id: workerInstance,
  });
  if (convergenceSweep.examined > 0) {
    logger.info('deadline-engine.worker: convergence sweep complete', {
      runId,
      workerInstance,
      ...convergenceSweep,
    });
  }

  let examined = 0;
  let claimed = 0;
  let sent = 0;
  let transientFailures = 0;
  let permanentFailures = 0;
  let deadLettered = 0;
  let leasesRecovered = 0;
  let cancelledSkipped = 0;

  // 1. Recover expired leases first so they can be re-claimed by this run.
  const recoveryResult = await db.execute(sql`
    update deadline_reminders
       set status = 'pending',
           lease_owner = null,
           lease_expires_at = null
     where status = 'claimed'
       and lease_expires_at <= ${nowIso}::timestamptz
     returning id, organization_id, source_deadline_id
  `);
  const recovered = recoveryResult as unknown as Array<{
    id: string;
    organization_id: string;
    source_deadline_id: string;
  }>;
  leasesRecovered = recovered.length;
  for (const row of recovered) {
    await writeDeadlineAuditEvent({
      organizationId: row.organization_id,
      sourceTable: 'grievance_deadlines',
      sourceDeadlineId: row.source_deadline_id,
      reminderId: row.id,
      eventType: 'reminder.lease_recovered',
      actorType: 'worker',
      actorId: workerInstance,
      correlationId: runId,
      metadata: { recovered_at: nowIso },
    });
  }

  // 2. Claim due reminders with FOR UPDATE SKIP LOCKED.
  const leaseExpiresIso = new Date(startedAt.getTime() + leaseMs).toISOString();
  const claimResult = await db.execute(sql`
    with due as (
      select id from deadline_reminders
       where status = 'pending'
         and scheduled_for <= ${nowIso}::timestamptz
       order by scheduled_for asc, id asc
       for update skip locked
       limit ${maxBatch}
    )
    update deadline_reminders
       set status = 'claimed',
           lease_owner = ${workerInstance},
           lease_expires_at = ${leaseExpiresIso}::timestamptz,
           attempt_count = attempt_count + 1
      from due
     where deadline_reminders.id = due.id
     returning
       deadline_reminders.id,
       deadline_reminders.source_deadline_id,
       deadline_reminders.organization_id,
       deadline_reminders.recipient_user_id,
       deadline_reminders.recipient_role,
       deadline_reminders.recipient_email,
       deadline_reminders.recipient_locale,
       deadline_reminders.message_subject,
       deadline_reminders.reminder_kind,
       deadline_reminders.offset_days,
       deadline_reminders.scheduled_for,
       deadline_reminders.attempt_count,
       deadline_reminders.max_attempts
  `);
  const claimedRows = claimResult as unknown as ClaimedReminderRow[];
  examined = claimedRows.length;
  claimed = claimedRows.length;

  for (const row of claimedRows) {
    await writeDeadlineAuditEvent({
      organizationId: row.organization_id,
      sourceTable: 'grievance_deadlines',
      sourceDeadlineId: row.source_deadline_id,
      reminderId: row.id,
      eventType: 'reminder.claimed',
      actorType: 'worker',
      actorId: workerInstance,
      correlationId: runId,
      metadata: {
        attempt_number: row.attempt_count,
        max_attempts: row.max_attempts,
      },
    });
  }

  // 3. Dispatch each claimed reminder.
  for (const row of claimedRows) {
    const attemptNumber = row.attempt_count; // already incremented at claim

    // Revalidate IMMEDIATELY before dispatch. A reminder can sit in
    // 'claimed' for up to leaseMs while the source deadline is completed,
    // cancelled, or the grievance is reassigned to someone else — none of
    // which touch an already-claimed row (reschedule/cancel only ever
    // touch status='pending'). Fail-closed: any ineligible condition
    // suppresses delivery and records a durable, auditable outcome instead
    // of silently returning.
    const [revalidation] = (await db.execute(sql`
      select
        dr.status          as reminder_status,
        gd.status          as deadline_status,
        gd.grievance_id    as grievance_id,
        g.union_rep_id     as current_union_rep_id
        from deadline_reminders dr
        left join grievance_deadlines gd on gd.id = dr.source_deadline_id
        left join grievances g on g.id = gd.grievance_id
       where dr.id = ${row.id}::uuid
    `)) as unknown as DispatchRevalidation[];

    const grievanceId = revalidation?.grievance_id ?? null;
    const isStaleOfficer =
      row.recipient_role === 'assigned_officer' &&
      row.recipient_user_id !== null &&
      row.recipient_user_id !== revalidation?.current_union_rep_id;
    const isEligible =
      !!revalidation &&
      revalidation.reminder_status === 'claimed' &&
      revalidation.deadline_status !== null &&
      revalidation.deadline_status !== 'completed' &&
      !isStaleOfficer;

    if (!isEligible) {
      const supersededReason = !revalidation || revalidation.deadline_status === null
        ? 'source_deadline_missing'
        : revalidation.reminder_status !== 'claimed'
          ? 'reminder_no_longer_claimed'
          : revalidation.deadline_status === 'completed'
            ? 'deadline_completed'
            : 'recipient_reassigned';

      await db.transaction(async (tx) => {
        await tx.execute(sql`
          insert into deadline_reminder_executions (
            reminder_id, attempt_number, outcome, error_code, error_message,
            duration_ms, worker_instance, correlation_id
          ) values (
            ${row.id}::uuid, ${attemptNumber}, 'skipped_cancelled',
            ${supersededReason}, ${'Suppressed at dispatch: ' + supersededReason},
            0, ${workerInstance}, ${runId}
          )
        `);
        await tx.execute(sql`
          update deadline_reminders
             set status = 'cancelled',
                 cancelled_reason = ${supersededReason},
                 lease_owner = null,
                 lease_expires_at = null
           where id = ${row.id}::uuid
        `);
      });

      cancelledSkipped++;
      await writeDeadlineAuditEvent({
        organizationId: row.organization_id,
        sourceTable: 'grievance_deadlines',
        sourceDeadlineId: row.source_deadline_id,
        reminderId: row.id,
        eventType: 'reminder.superseded_at_dispatch',
        actorType: 'worker',
        actorId: workerInstance,
        correlationId: runId,
        metadata: { attempt_number: attemptNumber, reason: supersededReason },
      });
      continue;
    }

    const attemptStart = Date.now();
    const dueDate = new Date(row.scheduled_for);
    // scheduled_for = dueDate - offset_days days → deadline occurs at
    // scheduled_for + offset_days.
    const deadlineDate = new Date(
      dueDate.getTime() + row.offset_days * 24 * 60 * 60 * 1000,
    );
    const daysToDeadline = isoDaysBetween(deadlineDate, clock());

    const outcome = await deliverDeadlineReminderEmail({
      recipientEmail: row.recipient_email,
      recipientLocale: row.recipient_locale,
      subject: row.message_subject,
      correlationId: runId,
      daysToDeadline,
      deadlineKind: row.reminder_kind === 'overdue' ? 'past-due deadline' : 'deadline',
      claimUrl: claimUrlBuilder(row, grievanceId),
      organizationId: row.organization_id,
    });

    const durationMs = Date.now() - attemptStart;

    if (outcome.kind === 'sent') {
      // Persist execution + transition to sent.
      await db.transaction(async (tx) => {
        await tx.execute(sql`
          insert into deadline_reminder_executions (
            reminder_id, attempt_number, outcome, provider, provider_message_id,
            duration_ms, worker_instance, correlation_id
          ) values (
            ${row.id}::uuid, ${attemptNumber}, 'sent',
            ${outcome.provider}, ${outcome.providerMessageId},
            ${durationMs}, ${workerInstance}, ${runId}
          )
        `);
        await tx.execute(sql`
          update deadline_reminders
             set status = 'sent',
                 sent_at = ${clock().toISOString()}::timestamptz,
                 lease_owner = null,
                 lease_expires_at = null,
                 provider = ${outcome.provider},
                 provider_message_id = ${outcome.providerMessageId},
                 last_error_code = null,
                 last_error_message = null
           where id = ${row.id}::uuid
        `);
      });
      sent++;
      await writeDeadlineAuditEvent({
        organizationId: row.organization_id,
        sourceTable: 'grievance_deadlines',
        sourceDeadlineId: row.source_deadline_id,
        reminderId: row.id,
        eventType: 'reminder.sent',
        actorType: 'worker',
        actorId: workerInstance,
        correlationId: runId,
        metadata: {
          attempt_number: attemptNumber,
          provider: outcome.provider,
          provider_message_id: outcome.providerMessageId,
          duration_ms: durationMs,
        },
      });
      continue;
    }

    // Failure paths
    const executionOutcome =
      outcome.kind === 'transient_failure' ? 'transient_failure' : 'permanent_failure';
    const errorCode =
      outcome.kind === 'disabled'
        ? 'email_disabled'
        : outcome.code || (outcome.statusCode ? `http_${outcome.statusCode}` : 'unknown');
    const errorMessage = outcome.kind === 'disabled' ? outcome.message : outcome.message;
    const providerName = outcome.kind === 'disabled' ? null : outcome.provider;

    const willRetry =
      outcome.kind === 'transient_failure' && attemptNumber < row.max_attempts;

    await db.transaction(async (tx) => {
      await tx.execute(sql`
        insert into deadline_reminder_executions (
          reminder_id, attempt_number, outcome, provider,
          provider_status_code, error_code, error_message,
          duration_ms, worker_instance, correlation_id
        ) values (
          ${row.id}::uuid, ${attemptNumber}, ${executionOutcome},
          ${providerName},
          ${outcome.kind === 'disabled' ? null : (outcome.statusCode ?? null)},
          ${errorCode}, ${errorMessage},
          ${durationMs}, ${workerInstance}, ${runId}
        )
      `);

      if (willRetry) {
        await tx.execute(sql`
          update deadline_reminders
             set status = 'pending',
                 lease_owner = null,
                 lease_expires_at = null,
                 last_error_code = ${errorCode},
                 last_error_message = ${errorMessage}
           where id = ${row.id}::uuid
        `);
      } else {
        // permanent OR out of attempts → dead letter
        await tx.execute(sql`
          update deadline_reminders
             set status = 'dead_letter',
                 dead_lettered_at = ${clock().toISOString()}::timestamptz,
                 lease_owner = null,
                 lease_expires_at = null,
                 last_error_code = ${errorCode},
                 last_error_message = ${errorMessage}
           where id = ${row.id}::uuid
        `);
      }
    });

    if (outcome.kind === 'transient_failure') transientFailures++;
    else permanentFailures++;

    if (!willRetry) {
      deadLettered++;
      await writeDeadlineAuditEvent({
        organizationId: row.organization_id,
        sourceTable: 'grievance_deadlines',
        sourceDeadlineId: row.source_deadline_id,
        reminderId: row.id,
        eventType: 'reminder.dead_lettered',
        actorType: 'worker',
        actorId: workerInstance,
        correlationId: runId,
        metadata: {
          attempt_number: attemptNumber,
          error_code: errorCode,
          reason: outcome.kind,
        },
      });
    } else {
      await writeDeadlineAuditEvent({
        organizationId: row.organization_id,
        sourceTable: 'grievance_deadlines',
        sourceDeadlineId: row.source_deadline_id,
        reminderId: row.id,
        eventType:
          outcome.kind === 'transient_failure'
            ? 'reminder.failed_transient'
            : 'reminder.failed_permanent',
        actorType: 'worker',
        actorId: workerInstance,
        correlationId: runId,
        metadata: {
          attempt_number: attemptNumber,
          error_code: errorCode,
          will_retry: willRetry,
        },
      });
    }
  }

  const finishedAt = clock();
  const result: WorkerRunResult = {
    runId,
    workerInstance,
    correlationId: runId,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    examined,
    claimed,
    sent,
    transientFailures,
    permanentFailures,
    deadLettered,
    leasesRecovered,
    cancelledSkipped,
  };

  logger.info('deadline-engine.worker: run finished', result);
  return result;
}

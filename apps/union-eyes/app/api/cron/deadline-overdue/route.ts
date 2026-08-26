/**
 * Deadline Overdue Detector Cron — Wave 1 Phase A
 *
 * Scans `grievance_deadlines` for rows whose due_date has passed and whose
 * status is not completed/cancelled. For each such deadline, schedules an
 * `overdue` reminder (offset = 0) if one is not already pending/sent.
 *
 * Capability: UE-DEADLINE-OVERDUE (state: PARTIALLY_IMPLEMENTED).
 */
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { withApi } from '@/lib/api/framework';
import { withSystemContext } from '@/lib/db/with-rls-context';
import {
  scheduleGrievanceDeadlineReminders,
  writeDeadlineAuditEvent,
} from '@/lib/deadline-engine';
import { createLogger } from '@nzila/os-core/telemetry';

const logger = createLogger('union-eyes.cron.deadline-overdue');

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface OverdueRow {
  id: string;
  grievance_id: string;
  organization_id: string;
  due_date: string;
}

export const GET = withApi(
  {
    auth: { cron: true },
    openapi: {
      tags: ['Cron'],
      summary: 'Detect overdue deadlines and enqueue overdue reminders',
    },
  },
  async () => {
    const runId = randomUUID();
    const startedAt = new Date();

    // Find deadlines that are past due and don't yet have an overdue
    // reminder in flight (pending or sent within the last 24h).
    const overdueRows = (await withSystemContext((tx) => tx.execute(sql`
      select
        gd.id                            as id,
        gd.grievance_id                  as grievance_id,
        g.organization_id                as organization_id,
        gd.due_date                      as due_date
      from grievance_deadlines gd
      join grievances g on g.id = gd.grievance_id
      where gd.due_date < now()
        and gd.status not in ('completed', 'cancelled')
        and not exists (
          select 1
            from deadline_reminders r
           where r.source_deadline_id = gd.id
             and r.reminder_kind = 'overdue'
             and (r.status = 'pending'
                  or (r.status = 'sent' and r.sent_at > now() - interval '24 hours'))
        )
      limit 200
    `))) as unknown as OverdueRow[];

    let scheduled = 0;
    let failed = 0;
    const errors: Array<{ deadlineId: string; error: string }> = [];

    for (const row of overdueRows) {
      try {
        const result = await scheduleGrievanceDeadlineReminders({
          sourceDeadlineId: row.id,
          grievanceId: row.grievance_id,
          dueDate: new Date(row.due_date),
          reminderOffsetsInDays: [0],
          reminderKind: 'overdue',
          actor: { type: 'system', id: 'cron:deadline-overdue' },
          correlationId: runId,
        });

        await writeDeadlineAuditEvent({
          organizationId: row.organization_id,
          sourceTable: 'grievance_deadlines',
          sourceDeadlineId: row.id,
          eventType: 'overdue.detected',
          actorType: 'system',
          actorId: 'cron:deadline-overdue',
          correlationId: runId,
          metadata: {
            scheduled_count: result.scheduled.length,
            due_date: row.due_date,
          },
        });
        scheduled += result.scheduled.length;
      } catch (error) {
        failed++;
        const message = error instanceof Error ? error.message : String(error);
        errors.push({ deadlineId: row.id, error: message });
        logger.error('deadline-overdue: failed to schedule overdue reminder', {
          runId,
          deadlineId: row.id,
          error: message,
        });
      }
    }

    const finishedAt = new Date();
    const payload = {
      runId,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      overdueCount: overdueRows.length,
      remindersScheduled: scheduled,
      failed,
      errors: errors.slice(0, 25),
    };

    logger.info('deadline-overdue: run finished', payload);
    return NextResponse.json(payload);
  },
);

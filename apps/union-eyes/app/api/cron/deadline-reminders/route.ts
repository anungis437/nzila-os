/**
 * Deadline Reminders Cron — Wave 1 Phase A
 *
 * Runs the deadline reminder worker: claims pending reminder rows whose
 * scheduled_for <= now, dispatches them via email, and transitions each row
 * to sent | failed | dead_letter with an immutable execution record.
 *
 * Capability: UE-DEADLINE-DELIVERY (state: PARTIALLY_IMPLEMENTED — awaiting
 * live staging proof before promotion to PROVEN_IN_STAGING).
 *
 * Auth: `withApi({ auth: { cron: true } })` requires `x-cron-secret` or a
 * `Bearer <CRON_SECRET_KEY>` Authorization header. Never publicly reachable.
 */
import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/framework';
import { runDeadlineReminderWorker } from '@/lib/deadline-engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const GET = withApi(
  {
    auth: { cron: true },
    openapi: {
      tags: ['Cron'],
      summary: 'Process due deadline reminders (deadline engine outbox)',
    },
  },
  async () => {
    const result = await runDeadlineReminderWorker();
    return NextResponse.json(result);
  },
);

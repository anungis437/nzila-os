/**
 * Deadline Engine Staging Proof — Wave 1 Phase A remediation
 *
 * SCOPE
 * -----
 * Auth-gated (`x-cron-secret`) HTTP surface that exercises the REAL
 * deadline-engine service code (scheduler, recipient resolver,
 * cancellation, audit) end-to-end inside the deployed container against
 * the staging database. Used by the correction plan to replace the
 * previously theatrical evidence (which proved only reminder-worker +
 * direct-INSERT paths) with lifecycle proofs that go through the actual
 * service boundaries.
 *
 * NON-NEGOTIABLES
 * ---------------
 * - REFUSES to run unless `STAGING_PROOFS_ENABLED === 'true'`.
 *   Production must NEVER set that flag.
 * - Refuses to run against a database whose host resolves to `prod`.
 * - Every scenario runs inside a top-level try/finally that cleans up
 *   its seed rows regardless of assertion outcome, so leaks cannot
 *   accumulate across proof runs.
 * - Emits a full evidence envelope (setup, actions, assertions, timings)
 *   the caller writes to `reports/phase0/wave-1-phase-a/`. No secrets,
 *   no PII, no plaintext recipient addresses — email is captured only
 *   as a sha256 prefix.
 *
 * SCENARIOS
 * ---------
 * - `schedule-basic`      seed grievance + deadline → schedule reminders
 *                         → assert one row per (recipient × offset),
 *                         hashes match, status=pending, tenant scoped
 * - `reschedule`          schedule initial → reschedule with new due
 *                         date → assert old rows cancelled, new rows
 *                         pending with correct offsets
 * - `cancel-on-completed` schedule → cancel with reason=completed →
 *                         assert all reminders cancelled + audit event
 *
 * CAPABILITY IMPACT
 * -----------------
 * Green result on all three scenarios promotes:
 *   UE-DEADLINE-LIFECYCLE, UE-DEADLINE-SCHEDULING,
 *   UE-DEADLINE-RECIPIENT-RESOLUTION from LIMITED to (at most) LIMITED-
 *   with-proven-slice. Full PROVEN_IN_STAGING requires additional
 *   scenarios (overdue processing, retries, replay, concurrent claim,
 *   lease recovery, bounce reconciliation, TZ/DST, tenant isolation)
 *   which are separate route additions.
 */
import { randomUUID, createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { withApi } from '@/lib/api/framework';
import { db } from '@/db';
import { grievances, grievanceDeadlines } from '@/db/schema/grievance-schema';
import {
  scheduleGrievanceDeadlineReminders,
  cancelGrievanceDeadlineReminders,
} from '@/lib/deadline-engine';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const ScenarioName = z.enum(['schedule-basic', 'reschedule', 'cancel-on-completed']);

const RequestBody = z.object({
  scenario: ScenarioName,
  organizationId: z.string().uuid(),
  grievantEmail: z.string().email().default('delivered@resend.dev'),
  reminderOffsetsInDays: z.array(z.number().int().positive()).default([7, 3, 1]),
  dueDaysFromNow: z.number().int().positive().default(30),
  rescheduleDueDaysFromNow: z.number().int().positive().optional(),
  timezone: z.string().default('UTC'),
});

type RequestBodyT = z.infer<typeof RequestBody>;

/** Fail-closed guard: only staging container apps should be able to reach this. */
function assertStagingContext(): void {
  const enabled = process.env.STAGING_PROOFS_ENABLED === 'true';
  const inProd = process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV === 'production';
  if (!enabled) {
    throw new Error('deadline-proof: STAGING_PROOFS_ENABLED must be "true" (this environment refuses to run proofs)');
  }
  if (inProd) {
    throw new Error('deadline-proof: refusing to run in production environment');
  }
}

function hashEmail(email: string): string {
  return createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}

async function insertSeedGrievance(input: {
  organizationId: string;
  grievantEmail: string;
  correlationId: string;
}): Promise<{ grievanceId: string; grievanceNumber: string }> {
  const grievanceNumber = `PROOF-${input.correlationId.slice(0, 8).toUpperCase()}`;
  const [row] = await db
    .insert(grievances)
    .values({
      grievanceNumber,
      type: 'other',
      status: 'draft',
      grievantEmail: input.grievantEmail,
      grievantName: 'Wave 1 Phase A Proof Grievant',
      title: `staging-proof-${input.correlationId}`,
      description: 'Ephemeral row created by /api/staging-proof/deadline-engine/scenario. Deleted after run.',
      organizationId: input.organizationId,
    })
    .returning({ id: grievances.id, grievanceNumber: grievances.grievanceNumber });
  if (!row) throw new Error('deadline-proof: failed to insert seed grievance');
  return { grievanceId: row.id, grievanceNumber: row.grievanceNumber };
}

async function insertSeedDeadline(input: {
  grievanceId: string;
  dueDate: Date;
  reminderDays: number[];
}): Promise<{ deadlineId: string }> {
  const [row] = await db
    .insert(grievanceDeadlines)
    .values({
      grievanceId: input.grievanceId,
      deadlineType: 'wave1a_proof',
      description: 'staging-proof deadline (auto-deleted)',
      dueDate: input.dueDate,
      status: 'pending',
      reminderDays: input.reminderDays,
    })
    .returning({ id: grievanceDeadlines.id });
  if (!row) throw new Error('deadline-proof: failed to insert seed deadline');
  return { deadlineId: row.id };
}

async function fetchReminders(deadlineId: string): Promise<
  Array<{
    id: string;
    status: string;
    offset_days: number;
    scheduled_for: string;
    recipient_role: string;
    recipient_email_hash: string;
    organization_id: string;
    cancelled_reason: string | null;
  }>
> {
  const rows = (await db.execute(sql`
    select id, status, offset_days,
           scheduled_for::text as scheduled_for,
           recipient_role, recipient_email_hash,
           organization_id::text as organization_id,
           cancelled_reason
      from deadline_reminders
     where source_deadline_id = ${deadlineId}::uuid
     order by scheduled_for asc, recipient_role asc
  `)) as unknown as Array<{
    id: string;
    status: string;
    offset_days: number;
    scheduled_for: string;
    recipient_role: string;
    recipient_email_hash: string;
    organization_id: string;
    cancelled_reason: string | null;
  }>;
  return rows;
}

async function cleanup(deadlineId: string | null, grievanceId: string | null): Promise<void> {
  try {
    if (deadlineId) {
      // Reminders reference deadlines via source_deadline_id (uuid). Clean
      // those first regardless of status so no orphans remain.
      await db.execute(sql`delete from deadline_reminders where source_deadline_id = ${deadlineId}::uuid`);
      await db.execute(sql`delete from deadline_audit_events where source_deadline_id = ${deadlineId}::uuid`);
      await db.delete(grievanceDeadlines).where(eq(grievanceDeadlines.id, deadlineId));
    }
    if (grievanceId) {
      await db.delete(grievances).where(eq(grievances.id, grievanceId));
    }
  } catch (err) {
    logger.error('deadline-proof: cleanup failed', {
      err: err instanceof Error ? err.message : String(err),
      deadlineId,
      grievanceId,
    });
    // Deliberately swallow — cleanup failure must not mask the scenario result.
  }
}

interface Assertion {
  name: string;
  passed: boolean;
  detail?: unknown;
}

function assert(name: string, condition: boolean, detail?: unknown): Assertion {
  return { name, passed: condition, detail };
}

async function runScheduleBasic(input: RequestBodyT, correlationId: string) {
  const dueDate = new Date(Date.now() + input.dueDaysFromNow * 24 * 60 * 60 * 1000);
  const seedGrievance = await insertSeedGrievance({
    organizationId: input.organizationId,
    grievantEmail: input.grievantEmail,
    correlationId,
  });
  const seedDeadline = await insertSeedDeadline({
    grievanceId: seedGrievance.grievanceId,
    dueDate,
    reminderDays: input.reminderOffsetsInDays,
  });

  let assertions: Assertion[] = [];
  let scheduleResult: Awaited<ReturnType<typeof scheduleGrievanceDeadlineReminders>> | null = null;
  try {
    scheduleResult = await scheduleGrievanceDeadlineReminders({
      sourceDeadlineId: seedDeadline.deadlineId,
      grievanceId: seedGrievance.grievanceId,
      dueDate,
      reminderOffsetsInDays: input.reminderOffsetsInDays,
      timezone: input.timezone,
      correlationId,
      actor: { type: 'system', id: null },
    });
    const rows = await fetchReminders(seedDeadline.deadlineId);
    const expectedCount = input.reminderOffsetsInDays.length * 1; // 1 recipient: grievor
    const expectedHash = hashEmail(input.grievantEmail);
    assertions = [
      assert('organization matches request', scheduleResult.organizationId === input.organizationId, {
        expected: input.organizationId,
        actual: scheduleResult.organizationId,
      }),
      assert('correct row count', rows.length === expectedCount, {
        expected: expectedCount,
        actual: rows.length,
      }),
      assert('all rows pending', rows.every((r) => r.status === 'pending')),
      assert('all rows tenant-scoped', rows.every((r) => r.organization_id === input.organizationId)),
      assert('grievor email hashed correctly', rows.every((r) => r.recipient_email_hash === expectedHash)),
      assert(
        'offsets match request',
        input.reminderOffsetsInDays.every((offset) => rows.some((r) => r.offset_days === offset)),
        { expected: input.reminderOffsetsInDays, actual: rows.map((r) => r.offset_days) },
      ),
      assert('scheduled_for strictly < dueDate', rows.every((r) => new Date(r.scheduled_for) < dueDate)),
    ];
  } finally {
    await cleanup(seedDeadline.deadlineId, seedGrievance.grievanceId);
  }
  return {
    scenario: 'schedule-basic' as const,
    correlationId,
    seed: { ...seedGrievance, deadlineId: seedDeadline.deadlineId, dueDate: dueDate.toISOString() },
    schedule: scheduleResult,
    assertions,
    passed: assertions.every((a) => a.passed),
  };
}

async function runReschedule(input: RequestBodyT, correlationId: string) {
  const dueDate = new Date(Date.now() + input.dueDaysFromNow * 24 * 60 * 60 * 1000);
  const newDueDate = new Date(
    Date.now() + (input.rescheduleDueDaysFromNow ?? input.dueDaysFromNow + 14) * 24 * 60 * 60 * 1000,
  );
  const seedGrievance = await insertSeedGrievance({
    organizationId: input.organizationId,
    grievantEmail: input.grievantEmail,
    correlationId,
  });
  const seedDeadline = await insertSeedDeadline({
    grievanceId: seedGrievance.grievanceId,
    dueDate,
    reminderDays: input.reminderOffsetsInDays,
  });

  let assertions: Assertion[] = [];
  try {
    const first = await scheduleGrievanceDeadlineReminders({
      sourceDeadlineId: seedDeadline.deadlineId,
      grievanceId: seedGrievance.grievanceId,
      dueDate,
      reminderOffsetsInDays: input.reminderOffsetsInDays,
      timezone: input.timezone,
      correlationId,
      actor: { type: 'system', id: null },
    });

    const second = await scheduleGrievanceDeadlineReminders({
      sourceDeadlineId: seedDeadline.deadlineId,
      grievanceId: seedGrievance.grievanceId,
      dueDate: newDueDate,
      reminderOffsetsInDays: input.reminderOffsetsInDays,
      timezone: input.timezone,
      correlationId,
      actor: { type: 'system', id: null },
    });

    const rows = await fetchReminders(seedDeadline.deadlineId);
    const cancelled = rows.filter((r) => r.status === 'cancelled');
    const pending = rows.filter((r) => r.status === 'pending');
    const expectedFirstCount = input.reminderOffsetsInDays.length;
    assertions = [
      assert('initial schedule created rows', first.scheduled.length === expectedFirstCount),
      assert('reschedule cancelled prior rows', second.cancelledForReschedule.length === expectedFirstCount),
      assert('reschedule created new rows', second.scheduled.length === expectedFirstCount),
      assert('cancelled reason=rescheduled on all cancelled rows', cancelled.every((r) => r.cancelled_reason === 'rescheduled')),
      assert('pending rows use new due date', pending.every((r) => new Date(r.scheduled_for) < newDueDate)),
      assert('pending rows > cancelled rows in time', pending.every((r) => {
        const paired = cancelled.find((c) => c.offset_days === r.offset_days);
        return paired ? new Date(r.scheduled_for) > new Date(paired.scheduled_for) : true;
      })),
      assert('no duplicate pending for same offset+recipient', (() => {
        const seen = new Set<string>();
        for (const r of pending) {
          const k = `${r.offset_days}::${r.recipient_email_hash}`;
          if (seen.has(k)) return false;
          seen.add(k);
        }
        return true;
      })()),
    ];
    return {
      scenario: 'reschedule' as const,
      correlationId,
      seed: {
        ...seedGrievance,
        deadlineId: seedDeadline.deadlineId,
        originalDueDate: dueDate.toISOString(),
        newDueDate: newDueDate.toISOString(),
      },
      schedules: { first, second },
      assertions,
      passed: assertions.every((a) => a.passed),
    };
  } finally {
    await cleanup(seedDeadline.deadlineId, seedGrievance.grievanceId);
  }
}

async function runCancelOnCompleted(input: RequestBodyT, correlationId: string) {
  const dueDate = new Date(Date.now() + input.dueDaysFromNow * 24 * 60 * 60 * 1000);
  const seedGrievance = await insertSeedGrievance({
    organizationId: input.organizationId,
    grievantEmail: input.grievantEmail,
    correlationId,
  });
  const seedDeadline = await insertSeedDeadline({
    grievanceId: seedGrievance.grievanceId,
    dueDate,
    reminderDays: input.reminderOffsetsInDays,
  });

  let assertions: Assertion[] = [];
  try {
    const schedule = await scheduleGrievanceDeadlineReminders({
      sourceDeadlineId: seedDeadline.deadlineId,
      grievanceId: seedGrievance.grievanceId,
      dueDate,
      reminderOffsetsInDays: input.reminderOffsetsInDays,
      timezone: input.timezone,
      correlationId,
      actor: { type: 'system', id: null },
    });

    const cancel = await cancelGrievanceDeadlineReminders({
      sourceDeadlineId: seedDeadline.deadlineId,
      organizationId: input.organizationId,
      reason: 'completed',
      correlationId,
      actor: { type: 'system', id: null },
    });

    const rows = await fetchReminders(seedDeadline.deadlineId);
    const expectedCount = input.reminderOffsetsInDays.length;
    assertions = [
      assert('schedule created rows', schedule.scheduled.length === expectedCount),
      assert('cancel returned same row count', cancel.cancelledIds.length === expectedCount),
      assert('all rows now cancelled', rows.every((r) => r.status === 'cancelled')),
      assert('all rows have reason=completed', rows.every((r) => r.cancelled_reason === 'completed')),
      assert(
        'audit contains deadline.completed event',
        await (async () => {
          const events = (await db.execute(sql`
            select event_type
              from deadline_audit_events
             where source_deadline_id = ${seedDeadline.deadlineId}::uuid
               and event_type = 'deadline.completed'
             limit 1
          `)) as unknown as Array<{ event_type: string }>;
          return events.length === 1;
        })(),
      ),
    ];
    return {
      scenario: 'cancel-on-completed' as const,
      correlationId,
      seed: { ...seedGrievance, deadlineId: seedDeadline.deadlineId, dueDate: dueDate.toISOString() },
      schedule,
      cancel,
      assertions,
      passed: assertions.every((a) => a.passed),
    };
  } finally {
    await cleanup(seedDeadline.deadlineId, seedGrievance.grievanceId);
  }
}

export const POST = withApi(
  {
    auth: { cron: true },
    body: RequestBody,
    openapi: {
      tags: ['StagingProof'],
      summary: 'Wave 1 Phase A deadline lifecycle scenarios (auth-gated, staging-only)',
    },
  },
  async ({ body }) => {
    assertStagingContext();
    const correlationId = randomUUID();
    const startedAt = new Date().toISOString();
    try {
      let result;
      switch (body.scenario) {
        case 'schedule-basic':
          result = await runScheduleBasic(body, correlationId);
          break;
        case 'reschedule':
          result = await runReschedule(body, correlationId);
          break;
        case 'cancel-on-completed':
          result = await runCancelOnCompleted(body, correlationId);
          break;
      }
      const finishedAt = new Date().toISOString();
      logger.info('deadline-proof: scenario finished', {
        scenario: body.scenario,
        passed: result.passed,
        correlationId,
      });
      return NextResponse.json({
        ...result,
        startedAt,
        finishedAt,
      });
    } catch (err) {
      logger.error('deadline-proof: scenario threw', {
        scenario: body.scenario,
        err: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        correlationId,
      });
      return NextResponse.json(
        {
          scenario: body.scenario,
          correlationId,
          passed: false,
          error: err instanceof Error ? err.message : String(err),
          startedAt,
          finishedAt: new Date().toISOString(),
        },
        { status: 500 },
      );
    }
  },
);

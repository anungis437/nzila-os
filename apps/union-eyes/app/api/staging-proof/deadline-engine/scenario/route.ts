/**
 * Deadline Engine Staging Proof — Wave 1 Phase A remediation
 *
 * SCOPE
 * -----
 * HMAC-gated HTTP surface that exercises the REAL
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
 * - `cancel`              schedule → cancel with reason=completed →
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
import { NextRequest, NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { grievances, grievanceDeadlines } from '@/db/schema/grievance-schema';
import { organizations } from '@/db/schema-organizations';
import {
  scheduleGrievanceDeadlineReminders,
  cancelGrievanceDeadlineReminders,
} from '@/lib/deadline-engine';
import { logger } from '@/lib/logger';
import {
  isAuthorizedStagingProofEnvironment,
  STAGING_PROOF_SCENARIOS,
  verifyProofAuthorization,
} from '@/lib/staging-proof/deadline-engine-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const ScenarioName = z.enum(STAGING_PROOF_SCENARIOS);
const RequestBody = z.object({ scenario: ScenarioName }).strict();

type RequestBodyT = z.infer<typeof RequestBody> & {
  organizationId: string;
  grievantEmail: string;
  reminderOffsetsInDays: number[];
  dueDaysFromNow: number;
  rescheduleDueDaysFromNow?: number;
  timezone: string;
};

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

async function fetchReminders(deadlineId: string): Promise<Array<{
  id: string;
  status: string;
  offset_days: number;
  scheduled_for: string;
  recipient_role: string;
  recipient_email_hash: string;
  organization_id: string;
  cancelled_reason: string | null;
}>> {
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
      await db.execute(sql`delete from deadline_reminders where source_deadline_id = ${deadlineId}::uuid`);
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
    throw new Error('deadline-proof: cleanup failed');
  }
}

async function claimNonce(nonce: string, proofRunId: string): Promise<boolean> {
  const rows = await db.execute(sql`insert into staging_proof_nonce_uses (nonce, proof_run_id, expires_at) values (${nonce}, ${proofRunId}::uuid, now() + interval '10 minutes') on conflict do nothing returning nonce`) as unknown as Array<{ nonce: string }>;
  return rows.length === 1;
}

async function recordProofEvent(input: { proofRunId: string; scenario: z.infer<typeof ScenarioName>; eventType: 'started' | 'completed' | 'failed' | 'cleanup_failed'; correlationId: string; createdIdentifiers?: Record<string, string>; actualOutcome?: Record<string, boolean>; cleanupPassed?: boolean }): Promise<void> {
  await db.execute(sql`insert into staging_proof_run_events (proof_run_id, scenario, event_type, correlation_id, created_identifiers, expected_outcome, actual_outcome, cleanup_passed) values (${input.proofRunId}::uuid, ${input.scenario}, ${input.eventType}, ${input.correlationId}, ${JSON.stringify(input.createdIdentifiers ?? {})}::jsonb, ${JSON.stringify({ service_boundary: true, cleanup: true })}::jsonb, ${JSON.stringify(input.actualOutcome ?? {})}::jsonb, ${input.cleanupPassed ?? null})`);
}

async function insertSyntheticOrganization(proofRunId: string): Promise<string> {
  const organizationId = randomUUID();
  await db.insert(organizations).values({ id: organizationId, name: `Staging Proof ${proofRunId}`, slug: `staging-proof-${proofRunId}`, organizationType: 'union', hierarchyPath: [organizationId], hierarchyLevel: 0, status: 'active', settings: { proof_run: true, cleanup_required: true } });
  return organizationId;
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
      assert('organization matches synthetic proof tenant', scheduleResult.organizationId === input.organizationId, {
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
        'offsets match proof configuration',
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

async function runCancel(input: RequestBodyT, correlationId: string) {
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
      scenario: 'cancel' as const,
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

export async function POST(request: NextRequest): Promise<NextResponse> {
  const env = {
    TARGET_ENVIRONMENT: process.env.TARGET_ENVIRONMENT,
    STAGING_PROOFS_ENABLED: process.env.STAGING_PROOFS_ENABLED,
    UNION_EYES_RUNTIME_ID: process.env.UNION_EYES_RUNTIME_ID,
    STAGING_PROOF_SECRET: process.env.STAGING_PROOF_SECRET,
  };
  if (!isAuthorizedStagingProofEnvironment(env)) return new NextResponse(null, { status: 404 });

  const rawBody = await request.json().catch(() => null);
  const parsed = RequestBody.safeParse(rawBody);
  if (!parsed.success) return NextResponse.json({ error: 'invalid proof request' }, { status: 400 });

  const authorization = verifyProofAuthorization({
    env,
    scenario: parsed.data.scenario,
    headers: {
      timestamp: request.headers.get('x-staging-proof-timestamp'),
      nonce: request.headers.get('x-staging-proof-nonce'),
      signature: request.headers.get('x-staging-proof-signature'),
    },
  });
  if (!authorization.authorized) return new NextResponse(null, { status: 404 });

  const proofRunId = randomUUID();
  const correlationId = randomUUID();
  if (!(await claimNonce(authorization.nonce, proofRunId))) return new NextResponse(null, { status: 404 });

  const startedAt = new Date().toISOString();
  let organizationId: string | null = null;
  try {
    await recordProofEvent({ proofRunId, scenario: parsed.data.scenario, eventType: 'started', correlationId });
    organizationId = await insertSyntheticOrganization(proofRunId);
    const input: RequestBodyT = {
      ...parsed.data,
      organizationId,
      grievantEmail: `deadline-proof-${proofRunId}@example.com`,
      reminderOffsetsInDays: [7, 3, 1],
      dueDaysFromNow: 30,
      rescheduleDueDaysFromNow: 44,
      timezone: 'UTC',
    };
    const result = parsed.data.scenario === 'schedule-basic'
      ? await runScheduleBasic(input, correlationId)
      : parsed.data.scenario === 'reschedule'
        ? await runReschedule(input, correlationId)
        : await runCancel(input, correlationId);
      const completedOrganizationId = organizationId;
      await db.delete(organizations).where(eq(organizations.id, completedOrganizationId));
    organizationId = null;
    await recordProofEvent({
      proofRunId,
      scenario: parsed.data.scenario,
      eventType: 'completed',
      correlationId,
      createdIdentifiers: { organizationId: completedOrganizationId },
      actualOutcome: { passed: result.passed },
      cleanupPassed: true,
    });
    return NextResponse.json({ ...result, proofRunId, startedAt, finishedAt: new Date().toISOString() });
  } catch (err) {
    let cleanupPassed = true;
    if (organizationId) {
      const cleanupOrganizationId = organizationId;
      try {
        await db.delete(organizations).where(eq(organizations.id, cleanupOrganizationId));
      } catch (cleanupError) {
        cleanupPassed = false;
        await recordProofEvent({
          proofRunId,
          scenario: parsed.data.scenario,
          eventType: 'cleanup_failed',
          correlationId,
          createdIdentifiers: { organizationId: cleanupOrganizationId },
          actualOutcome: { passed: false },
          cleanupPassed: false,
        }).catch(() => undefined);
        logger.error('deadline-proof: organization cleanup failed', {
          proofRunId,
          correlationId,
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        });
      }
    }
    await recordProofEvent({
      proofRunId,
      scenario: parsed.data.scenario,
      eventType: 'failed',
      correlationId,
      createdIdentifiers: organizationId ? { organizationId } : {},
      actualOutcome: { passed: false },
      cleanupPassed,
    }).catch(() => undefined);
    logger.error('deadline-proof: scenario failed', { proofRunId, correlationId, scenario: parsed.data.scenario });
    return NextResponse.json({ proofRunId, correlationId, passed: false, startedAt, finishedAt: new Date().toISOString() }, { status: 500 });
  }
}

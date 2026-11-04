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
 * - Runs as the SYSTEM role. The route is HMAC-authenticated and has no user
 *   session, and a tenant transaction (`withRLSContext`) needs an
 *   authenticated actor who is a member of the organization, which a
 *   synthetic proof tenant never has; the system role is the only principal a
 *   session-less caller holds, so every statement here is one the storage
 *   authority manifest grants it.
 * - Every scenario runs, organization and seed rows included, in ONE system
 *   transaction that is always rolled back, so nothing it creates can be left
 *   behind or accumulate across proof runs, and the system role needs no
 *   DELETE and no UPDATE of an organization. The run itself is recorded in
 *   the ledger (lib/staging-proof/ledger.ts), which commits separately.
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
import { deadlineInOrganization } from '@/lib/deadline-engine/deadline-scope';
import { grievances } from '@/db/schema/domains/claims/grievances';
import { grievanceDeadlines } from '@/db/schema/domains/claims/workflows';
import { organizations } from '@/db/schema-organizations';
import {
  scheduleGrievanceDeadlineReminders,
  cancelGrievanceDeadlineReminders,
} from '@/lib/deadline-engine';
import { completeDeadline } from '@/lib/deadline-tracking-system';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { logger } from '@/lib/logger';
import { createProofRun, finalizeProofRun } from '@/lib/staging-proof/ledger';
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
      description: 'Ephemeral row created by /api/staging-proof/deadline-engine/scenario; its transaction is always rolled back.',
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
      description: 'staging-proof deadline (rolled back with its transaction)',
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

async function insertSyntheticOrganization(organizationId: string, proofRunId: string): Promise<void> {
  await db.insert(organizations).values({ id: organizationId, name: `Staging Proof ${proofRunId}`, slug: `staging-proof-${proofRunId}`, organizationType: 'union', hierarchyPath: [organizationId], hierarchyLevel: 0, status: 'active', settings: { proof_run: true } });
}

class ScenarioRolledBack<T> extends Error {
  constructor(readonly result: T) {
    super('deadline-proof: scenario result carried out of its rolled-back transaction');
  }
}

/**
 * Runs the work in one system-role transaction and rolls it back whatever the work does, returning what it returned. The organization, the seed rows and everything
 * the deadline engine wrote exist only inside it, so a scenario that fails half way leaves nothing behind either. `db` resolves to the transaction inside it.
 */
async function inRolledBackTransaction<T>(work: () => Promise<T>): Promise<T> {
  try {
    await withSystemContext(async () => {
      throw new ScenarioRolledBack(await work());
    });
  } catch (error) {
    if (error instanceof ScenarioRolledBack) return error.result as T;
    throw error;
  }
  throw new Error('deadline-proof: a scenario transaction committed');
}

async function fetchDeadline(deadlineId: string, expectedDueDate?: Date): Promise<{
  status: string;
  due_date_matches: boolean | null;
} | null> {
  const rows = (await db.execute(sql`
    select status,
           ${expectedDueDate?.toISOString() ?? null}::timestamptz is null
             or due_date = ${expectedDueDate?.toISOString() ?? null}::timestamptz as due_date_matches
      from grievance_deadlines
     where id = ${deadlineId}::uuid
  `)) as unknown as Array<{ status: string; due_date_matches: boolean | null }>;
  return rows[0] ?? null;
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

  const scheduleResult = await scheduleGrievanceDeadlineReminders({
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
  const assertions: Assertion[] = [
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

  const first = await scheduleGrievanceDeadlineReminders({
    sourceDeadlineId: seedDeadline.deadlineId,
    grievanceId: seedGrievance.grievanceId,
    dueDate,
    reminderOffsetsInDays: input.reminderOffsetsInDays,
    timezone: input.timezone,
    correlationId,
    actor: { type: 'system', id: null },
  });

  await db
    .update(grievanceDeadlines)
    .set({ dueDate: newDueDate, notes: `Rescheduled by staging proof ${correlationId}` })
    .where(and(eq(grievanceDeadlines.id, seedDeadline.deadlineId), deadlineInOrganization(input.organizationId)));

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
  const sourceDeadline = await fetchDeadline(seedDeadline.deadlineId, newDueDate);
  const cancelled = rows.filter((r) => r.status === 'cancelled');
  const pending = rows.filter((r) => r.status === 'pending');
  const expectedFirstCount = input.reminderOffsetsInDays.length;
  const assertions: Assertion[] = [
    assert('initial schedule created rows', first.scheduled.length === expectedFirstCount),
    assert('reschedule cancelled prior rows', second.cancelledForReschedule.length === expectedFirstCount),
    assert('reschedule created new rows', second.scheduled.length === expectedFirstCount),
    assert('source deadline due date changed', sourceDeadline?.due_date_matches === true),
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

  const schedule = await scheduleGrievanceDeadlineReminders({
    sourceDeadlineId: seedDeadline.deadlineId,
    grievanceId: seedGrievance.grievanceId,
    dueDate,
    reminderOffsetsInDays: input.reminderOffsetsInDays,
    timezone: input.timezone,
    correlationId,
    actor: { type: 'system', id: null },
  });

  const completion = await completeDeadline(
    seedDeadline.deadlineId,
    input.organizationId,
    'staging-proof',
    `Completed by staging proof ${correlationId}`,
  );
  if (!completion.success) {
    throw new Error(`deadline-proof: source deadline completion failed: ${completion.error ?? 'unknown error'}`);
  }

  const cancel = await cancelGrievanceDeadlineReminders({
    sourceDeadlineId: seedDeadline.deadlineId,
    organizationId: input.organizationId,
    reason: 'completed',
    correlationId,
    actor: { type: 'system', id: null },
  });

  const rows = await fetchReminders(seedDeadline.deadlineId);
  const sourceDeadline = await fetchDeadline(seedDeadline.deadlineId);
  const expectedCount = input.reminderOffsetsInDays.length;
  const assertions: Assertion[] = [
    assert('schedule created rows', schedule.scheduled.length === expectedCount),
    // completeDeadline cancels the deadline's pending reminders itself (the legacy queue and the engine's outbox), so the explicit cancel that follows has nothing left to cancel.
    assert('completion cancelled every scheduled reminder, so a second cancel finds none', rows.length === expectedCount && cancel.cancelledIds.length === 0),
    assert('all rows now cancelled', rows.every((r) => r.status === 'cancelled')),
    assert('all rows have reason=completed', rows.every((r) => r.cancelled_reason === 'completed')),
    assert('source deadline transitioned to completed', sourceDeadline?.status === 'completed'),
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
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const env = {
    // Referenced literally so the bundler inlines the value the image was built with.
    BUILD_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    TARGET_ENVIRONMENT: process.env.TARGET_ENVIRONMENT,
    STAGING_PROOFS_ENABLED: process.env.STAGING_PROOFS_ENABLED,
    UNION_EYES_RUNTIME_ID: process.env.UNION_EYES_RUNTIME_ID,
    STAGING_PROOF_SECRET: process.env.STAGING_PROOF_SECRET,
    UE_ENVIRONMENT: process.env.UE_ENVIRONMENT,
    NZILA_MODE: process.env.NZILA_MODE,
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
  const correlationId = proofRunId;
  try {
    if (!(await createProofRun({ proofRunId, nonce: authorization.nonce, scenario: parsed.data.scenario, correlationId }))) {
      return new NextResponse(null, { status: 404 });
    }
  } catch (ledgerError) {
    // The caller learns nothing (a replayed nonce and an unavailable ledger both look like no route); the operator is told.
    logger.error('deadline-proof: the ledger refused to open a run', {
      proofRunId,
      correlationId,
      error: ledgerError instanceof Error ? ledgerError.message : String(ledgerError),
    });
    return new NextResponse(null, { status: 404 });
  }

  const startedAt = new Date().toISOString();
  const organizationId = randomUUID();
  try {
    const input: RequestBodyT = {
      ...parsed.data,
      organizationId,
      grievantEmail: `deadline-proof-${proofRunId}@example.com`,
      reminderOffsetsInDays: [7, 3, 1],
      dueDaysFromNow: 30,
      rescheduleDueDaysFromNow: 44,
      timezone: 'UTC',
    };
    // The synthetic organization is made inside the scenario's transaction, so it and everything the scenario wrote are rolled back with it.
    const result = await inRolledBackTransaction(async () => {
      await insertSyntheticOrganization(organizationId, proofRunId);
      return parsed.data.scenario === 'schedule-basic'
        ? runScheduleBasic(input, correlationId)
        : parsed.data.scenario === 'reschedule'
          ? runReschedule(input, correlationId)
          : runCancel(input, correlationId);
    });
    await finalizeProofRun({
      proofRunId,
      scenario: parsed.data.scenario,
      eventType: 'completed',
      correlationId,
      createdIdentifiers: { organizationId },
      actualOutcome: { passed: result.passed },
      cleanupPassed: true,
    });
    return NextResponse.json({ ...result, proofRunId, startedAt, finishedAt: new Date().toISOString() });
  } catch (err) {
    // A failed scenario rolled its transaction back too: there is nothing to clean up, and the ledger says the run failed.
    await finalizeProofRun({
      proofRunId,
      scenario: parsed.data.scenario,
      eventType: 'failed',
      correlationId,
      createdIdentifiers: { organizationId },
      actualOutcome: { passed: false },
      cleanupPassed: true,
    }).catch((ledgerError: unknown) => {
      logger.error('deadline-proof: the failed run could not be settled in the ledger', {
        proofRunId,
        correlationId,
        error: ledgerError instanceof Error ? ledgerError.message : String(ledgerError),
      });
    });
    logger.error('deadline-proof: scenario failed', {
      proofRunId,
      correlationId,
      scenario: parsed.data.scenario,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ proofRunId, correlationId, passed: false, startedAt, finishedAt: new Date().toISOString() }, { status: 500 });
  }
}

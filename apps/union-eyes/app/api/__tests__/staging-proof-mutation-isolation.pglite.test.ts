import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import type { PGlite } from '@electric-sql/pglite';
import { grievances } from '@/db/schema/domains/claims/grievances';
import { grievanceDeadlines } from '@/db/schema/domains/claims/workflows';
import { organizations } from '@/db/schema-organizations';
import { createProofSignature } from '@/lib/staging-proof/deadline-engine-auth';
import { createTableDatabase } from './support/pglite-tables';

// UE-CONV-K-006: the HMAC-gated staging proof route runs each scenario, its synthetic organization and seed rows included, in one system transaction that it always rolls
// back, so it deletes nothing and leaves nothing. Its one UPDATE (the reschedule of the seed deadline) carries the synthetic organization, so a seed row that no longer
// belongs to it is not rewritten.

const state = vi.hoisted(() => ({
  db: null as unknown,
  pg: null as unknown,
  onFirstSchedule: null as null | ((args: { grievanceId: string }) => Promise<void>),
  dueDateAtSecondSchedule: null as string | null,
  scheduleCalls: 0,
}));

vi.mock('@/db', async () => {
  const { lateBoundDb } = await import('./support/pglite-tables');
  return { db: lateBoundDb(state) };
});
// The ledger relations are SYSTEM_ONLY and the scenario runs as the system role: both go through the system context, which here is a transaction on the same PGlite
// database. Inside it `db` is that transaction (as in the application), so a statement of the scenario is part of it and rolls back with it.
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: (operation: (tx: unknown) => Promise<unknown>) =>
    (state.db as { transaction: (callback: (tx: unknown) => Promise<unknown>) => Promise<unknown> }).transaction(async (tx) => {
      const outer = state.db;
      state.db = tx;
      try {
        return await operation(tx);
      } finally {
        state.db = outer;
      }
    }),
}));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));
vi.mock('@/lib/deadline-tracking-system', () => ({ completeDeadline: vi.fn() }));
vi.mock('@/lib/deadline-engine', () => ({
  cancelGrievanceDeadlineReminders: vi.fn(),
  scheduleGrievanceDeadlineReminders: async (args: { sourceDeadlineId: string; grievanceId: string }) => {
    state.scheduleCalls += 1;
    if (state.scheduleCalls === 1) await state.onFirstSchedule?.(args);
    else {
      const { sql } = await import('drizzle-orm');
      const rows = await (state.db as { execute: (query: unknown) => Promise<Array<{ due_date: string }>> }).execute(
        sql`SELECT due_date::text AS due_date FROM grievance_deadlines WHERE id = ${args.sourceDeadlineId}`,
      );
      state.dueDateAtSecondSchedule = rows[0]?.due_date ?? null;
    }
    return { scheduled: [], cancelledForReschedule: [] };
  },
}));

const ORG_OTHER = '22222222-2222-4222-8222-222222222222';
const SECRET = '7c41e0a95d2b83f6190ae4c7b58d3f2a6e1d09b47c5a8f23';

let pg: PGlite;

/** drizzle's pglite driver returns {rows}; the route reads execute() results as arrays, as the postgres driver gives. */
function withArrayResults<T extends object>(database: T): T {
  return new Proxy(database, {
    get(target, property) {
      const value = (target as Record<PropertyKey, unknown>)[property];
      if (property === 'execute') return async (query: unknown) => ((await (value as (q: unknown) => Promise<{ rows: unknown[] }>).call(target, query)).rows);
      if (property === 'transaction') {
        return (callback: (tx: unknown) => unknown) => (value as (cb: (tx: unknown) => unknown) => unknown).call(target, (tx: object) => callback(withArrayResults(tx)));
      }
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

function proofRequest(scenario: 'reschedule' | 'schedule-basic') {
  const timestamp = new Date().toISOString();
  const nonce = `proof_nonce_${randomBytes(12).toString('hex')}`;
  return new NextRequest('http://localhost/api/staging-proof/deadline-engine/scenario', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-staging-proof-timestamp': timestamp,
      'x-staging-proof-nonce': nonce,
      'x-staging-proof-signature': createProofSignature(SECRET, timestamp, nonce, scenario),
    },
    body: JSON.stringify({ scenario }),
  });
}

async function count(table: string) {
  return Number((await pg.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n);
}

beforeAll(async () => {
  const created = await createTableDatabase([organizations, grievances, grievanceDeadlines], [
    'CREATE TABLE staging_proof_nonce_uses (nonce text PRIMARY KEY, proof_run_id uuid, expires_at timestamptz)',
    'CREATE TABLE staging_proof_runs (id uuid PRIMARY KEY, nonce text, scenario text, correlation_id text, status text, cleanup_passed boolean, finalized_at timestamptz)',
    'CREATE TABLE staging_proof_run_events (proof_run_id uuid, scenario text, event_type text, correlation_id text, created_identifiers jsonb, expected_outcome jsonb, actual_outcome jsonb, cleanup_passed boolean)',
    'CREATE TABLE deadline_reminders (id uuid DEFAULT gen_random_uuid(), status text, offset_days int, scheduled_for timestamptz, recipient_role text, recipient_email_hash text, organization_id uuid, cancelled_reason text, source_deadline_id uuid)',
  ]);
  pg = created.pg;
  state.pg = pg;
  state.db = withArrayResults(created.db);
  process.env.NEXT_PUBLIC_APP_ENV = 'staging';
  process.env.TARGET_ENVIRONMENT = 'staging';
  process.env.STAGING_PROOFS_ENABLED = 'true';
  process.env.UNION_EYES_RUNTIME_ID = 'union-eyes-staging';
  process.env.STAGING_PROOF_SECRET = SECRET;
});

afterAll(async () => {
  await pg.close();
});

beforeEach(async () => {
  await pg.exec('TRUNCATE grievance_deadlines, grievances, deadline_reminders, staging_proof_run_events, staging_proof_runs, staging_proof_nonce_uses');
  state.onFirstSchedule = null;
  state.dueDateAtSecondSchedule = null;
  state.scheduleCalls = 0;
});

describe('staging-proof deadline-engine scenario — organization-bound mutation', () => {
  it('reschedules inside one transaction and leaves no seed row, deadline or synthetic organization behind', async () => {
    const { POST } = await import('../staging-proof/deadline-engine/scenario/route');

    const response = await POST(proofRequest('reschedule'));

    expect(response.status).toBe(200);
    expect(state.scheduleCalls).toBe(2);
    expect(state.dueDateAtSecondSchedule).not.toBeNull();
    expect(await count('grievance_deadlines')).toBe(0);
    expect(await count('grievances')).toBe(0);
    expect(await count('organizations')).toBe(0);
  });

  it('does not reschedule a seed row that no longer belongs to the synthetic organization, and still leaves nothing behind', async () => {
    const { POST } = await import('../staging-proof/deadline-engine/scenario/route');
    let originalDueDate: string | null = null;
    state.onFirstSchedule = async ({ grievanceId }) => {
      // Inside the scenario's transaction: the handle is the transaction, not the database.
      const run = (state.db as { execute: (query: unknown) => Promise<Array<{ due_date: string }>> }).execute;
      await run(sql`UPDATE grievances SET organization_id = ${ORG_OTHER} WHERE id = ${grievanceId}`);
      originalDueDate = (await run(sql`SELECT due_date::text AS due_date FROM grievance_deadlines WHERE grievance_id = ${grievanceId}`))[0].due_date;
    };

    const response = await POST(proofRequest('reschedule'));

    expect(response.status).toBe(200);
    expect(state.dueDateAtSecondSchedule).toBe(originalDueDate);
    expect(await count('grievance_deadlines')).toBe(0);
    expect(await count('grievances')).toBe(0);
  });

  it('rolls everything back when the scenario fails, and records the failed run', async () => {
    const { POST } = await import('../staging-proof/deadline-engine/scenario/route');
    state.onFirstSchedule = async () => {
      throw new Error('the deadline engine failed');
    };

    const response = await POST(proofRequest('reschedule'));

    expect(response.status).toBe(500);
    expect(await count('grievance_deadlines')).toBe(0);
    expect(await count('grievances')).toBe(0);
    expect(await count('organizations')).toBe(0);
    const run = await pg.query<{ status: string; cleanup_passed: boolean }>('SELECT status, cleanup_passed FROM staging_proof_runs');
    expect(run.rows).toEqual([{ status: 'failed', cleanup_passed: true }]);
  });
});

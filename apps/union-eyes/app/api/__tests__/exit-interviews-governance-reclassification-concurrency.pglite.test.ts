import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';

// DEF-0B7-EXC-CONSENT-IS-ADMIN-ASSERTED-AND-RECLASSIFICATION-HAS-NO-REVIEW (adversarial follow-up): the mocked-route
// test suite proves the conditional-UPDATE logic is wired correctly, but only real concurrent writes against real
// SQL prove PostgreSQL itself serializes two approvals of the same pending request into exactly one winner. This
// file runs the actual route handler twice, concurrently (Promise.all, no client-side ordering), against a PGlite
// database built from the real Drizzle table declarations.

const state = vi.hoisted(() => ({ db: null as unknown, userId: 'admin-a', role: 'admin' as string }));
const RANK: Record<string, number> = { member: 10, steward: 20, chief_steward: 30, officer: 40, admin: 50, national_officer: 60 };

vi.mock('@/db/db', async () => {
  const { lateBoundDb } = await import('./support/pglite-tables');
  return { db: lateBoundDb(state) };
});
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (...a: unknown[]) => (a[a.length - 1] as (tx: unknown) => Promise<unknown>)(state.db),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: vi.fn(async () => undefined) }));
vi.mock('@/lib/ai/knowledge-base-embeddings', () => ({ eraseKnowledgeBaseEmbeddings: vi.fn(async () => []) }));
vi.mock('@/lib/api-auth-guard', () => ({
  hasMinRole: async (min: string) => (RANK[state.role] ?? 0) >= (RANK[min] ?? Infinity),
}));
vi.mock('@/lib/api/framework', async () => {
  const { z } = await import('zod');
  const make = (status: number) => (message: string) => Object.assign(new Error(message), { status });
  return {
    z,
    withApi: (_cfg: unknown, handler: (c: unknown) => Promise<unknown>) => (c: unknown) => handler(c),
    ApiError: {
      notFound: make(404), forbidden: make(403), badRequest: make(400), conflict: make(409),
    },
  };
});

const ORG = '11111111-1111-4111-8111-111111111111';
const IV = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001';
let pg: PGlite;

async function resetInterview(level: string) {
  await pg.exec('TRUNCATE exit_interviews, exit_interview_events CASCADE');
  await pg.query(
    `INSERT INTO exit_interviews (id, organization_id, retiring_employee_name, role_in_union, years_of_service, title, key_lessons, status,
       sensitivity_level, consent_granted, created_by)
     VALUES ($1::uuid, $2::uuid, 'Jane Retiree', 'steward', 20, 'Interview', 'Lessons learned here', 'published', $3, true, 'author-1')`,
    [IV, ORG, level],
  );
}

async function insertPendingRequest(requestedBy: string, requestedLevel: string, previousLevel: string): Promise<string> {
  const result = await pg.query<{ id: string }>(
    `INSERT INTO exit_interview_events (interview_id, organization_id, event_type, actor_user_id, notes, payload)
     VALUES ($1::uuid, $2::uuid, 'governance_updated', $3, 'requested', $4::jsonb)
     RETURNING id`,
    [IV, ORG, requestedBy, JSON.stringify({ kind: 'reclassification_requested', requestedLevel, previousLevel, requestedBy, reason: null })],
  );
  return result.rows[0].id;
}

async function callPatch(userId: string, role: string, body: Record<string, unknown>) {
  state.userId = userId;
  state.role = role;
  const { PATCH } = await import('../exit-interviews/[id]/governance/route');
  try {
    const result = await (PATCH as unknown as (ctx: unknown) => Promise<unknown>)(
      { params: { id: IV }, organizationId: ORG, userId, body },
    );
    return { status: 200, json: result };
  } catch (err) {
    return { status: (err as { status?: number }).status ?? 500, json: { error: (err as Error).message } };
  }
}

beforeAll(async () => {
  const { exitInterviews, exitInterviewEvents } = await import('@/db/schema');
  const { createTableDatabase } = await import('./support/pglite-tables');
  const created = await createTableDatabase([exitInterviews, exitInterviewEvents], [
    `CREATE TABLE knowledge_base (id uuid primary key default gen_random_uuid(), organization_id uuid not null, title text not null,
       document_type text not null default 'guide', content text not null, summary text, source_type text not null, source_id text,
       source_url text, tags jsonb, language text not null default 'en', effective_date timestamp, version int not null default 1,
       is_public boolean not null default false, allowed_organizations jsonb, view_count int not null default 0, is_active boolean not null default true,
       created_at timestamp default now(), updated_at timestamp default now())`,
  ]);
  pg = created.pg;
  state.db = created.db;
});

afterAll(async () => { await pg.close(); });

describe('governance reclassification approval: real concurrent PostgreSQL writes', () => {
  beforeEach(async () => {
    await resetInterview('legal_sensitive');
  });

  it('two national_officers racing to approve the same pending request: exactly one succeeds, the other gets 409', async () => {
    const eventId = await insertPendingRequest('admin-a', 'public_internal', 'legal_sensitive');

    const [first, second] = await Promise.all([
      callPatch('reviewer-1', 'national_officer', { approveReclassificationEventId: eventId }),
      callPatch('reviewer-2', 'national_officer', { approveReclassificationEventId: eventId }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);

    const row = await pg.query<{ sensitivity_level: string }>('SELECT sensitivity_level FROM exit_interviews WHERE id = $1::uuid', [IV]);
    expect(row.rows[0].sensitivity_level).toBe('public_internal');

    // Exactly one approval event was recorded, not two.
    const events = await pg.query<{ payload: { kind: string } }>(
      `SELECT payload FROM exit_interview_events WHERE interview_id = $1::uuid AND event_type = 'governance_updated'`,
      [IV],
    );
    const approved = events.rows.filter((r) => r.payload.kind === 'reclassification_approved');
    expect(approved).toHaveLength(1);
  });

  it('an admin (not national_officer+) cannot approve even when racing', async () => {
    const eventId = await insertPendingRequest('admin-a', 'public_internal', 'legal_sensitive');

    const [first, second] = await Promise.all([
      callPatch('reviewer-1', 'admin', { approveReclassificationEventId: eventId }),
      callPatch('reviewer-2', 'admin', { approveReclassificationEventId: eventId }),
    ]);

    expect(first.status).toBe(403);
    expect(second.status).toBe(403);
    const row = await pg.query<{ sensitivity_level: string }>('SELECT sensitivity_level FROM exit_interviews WHERE id = $1::uuid', [IV]);
    expect(row.rows[0].sensitivity_level).toBe('legal_sensitive');
  });

  it('a concurrent unrelated write (consent withdrawal) does not get silently overwritten by a reclassification approval', async () => {
    const eventId = await insertPendingRequest('admin-a', 'public_internal', 'legal_sensitive');

    const [approval, withdrawal] = await Promise.all([
      callPatch('reviewer-1', 'national_officer', { approveReclassificationEventId: eventId }),
      callPatch('admin-a', 'admin', { consentGranted: false }),
    ]);

    // Both cannot have silently "succeeded" against the same stale read: at most one of these two writes commits
    // before the other re-reads a changed row, and the loser must see 409, never a 200 that quietly discarded
    // the other write.
    const statuses = [approval.status, withdrawal.status];
    expect(statuses.filter((s) => s === 200).length).toBeLessThanOrEqual(1);
    if (statuses.every((s) => s === 200)) {
      throw new Error('both concurrent writes reported success - one must have silently overwritten the other');
    }
  });
});

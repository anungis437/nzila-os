import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// DEF-0B6-CMP-DISPATCH-RULES-ENGINE-NEVER-APPLIED: an assignment accepted any member ids for any request in any state, in any number, and
// counted a request as filled from the ids of one call. The choice is now validated and the request row locked, on real SQL.
const state = vi.hoisted(() => ({ db: null as unknown }));

vi.mock('@/db/db', async () => {
  const { lateBoundDb } = await import('./support/pglite-tables');
  return { db: lateBoundDb(state) };
});

const ORG = '11111111-1111-4111-8111-111111111111';
const OTHER_ORG = '22222222-2222-4222-8222-222222222222';
const REQ = '33333333-3333-4333-8333-333333333333';
const M = [1, 2, 3, 4].map((n) => `4444444${n}-4444-4444-8444-44444444444${n}`);
const OTHER_ORG_MEMBER = '55555555-5555-4555-8555-555555555555';

let pg: import('@electric-sql/pglite').PGlite;
type Engine = typeof import('@/lib/services/dispatch-engine');
let engine: Engine;

async function request(status = 'open', workers = 2, org = ORG) {
  await pg.query(
    `INSERT INTO dispatch_requests (id, org_id, employer_id, job_title, requested_workers, status, requested_date) VALUES ($1::uuid, $2::uuid, gen_random_uuid(), 'Welder', $3, $4, now())`,
    [REQ, org, workers, status],
  );
}
async function member(id: string, org: string, status = 'active') {
  await pg.query(
    `INSERT INTO organization_members (id, user_id, organization_id, role, status, name, email) VALUES ($1::uuid, $1, $2::uuid, 'member', $3, 'n', 'e@x.example')`,
    [id, org, status],
  );
}
const assignments = async () => (await pg.query('SELECT member_id, status FROM dispatch_assignments ORDER BY member_id')).rows as Array<{ member_id: string; status: string }>;
const requestStatus = async () => ((await pg.query('SELECT status FROM dispatch_requests WHERE id = $1::uuid', [REQ])).rows[0] as { status: string }).status;
const reason = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return (error as { reason?: string }).reason;
  }
  return 'no error';
};

beforeAll(async () => {
  const { createTableDatabase } = await import('./support/pglite-tables');
  const { dispatchRequests, dispatchAssignments } = await import('@/db/schema/domains/dispatch/dispatch');
  const { organizationMembers } = await import('@/db/schema-organizations');
  const created = await createTableDatabase([dispatchRequests, dispatchAssignments, organizationMembers]);
  pg = created.pg;
  state.db = created.db;
  engine = await import('@/lib/services/dispatch-engine');
});

afterAll(async () => {
  await pg.close();
});

beforeEach(async () => {
  await pg.exec('TRUNCATE dispatch_assignments, dispatch_requests, organization_members');
  await member(M[0], ORG);
  await member(M[1], ORG);
  await member(M[2], ORG);
  await member(M[3], ORG, 'suspended');
  await member(OTHER_ORG_MEMBER, OTHER_ORG);
});

describe('assignWorkersToDispatch', () => {
  it('offers the request to active members of the organization and marks it filled when it is', async () => {
    await request('open', 2);
    const rows = await engine.assignWorkersToDispatch(ORG, REQ, [M[0], M[1]]);
    expect(rows).toHaveLength(2);
    expect(await assignments()).toEqual([{ member_id: M[0], status: 'offered' }, { member_id: M[1], status: 'offered' }]);
    expect(await requestStatus()).toBe('filled');
  });

  it('counts workers already offered, so a second call fills the request and a third is over capacity', async () => {
    await request('open', 2);
    await engine.assignWorkersToDispatch(ORG, REQ, [M[0]]);
    expect(await requestStatus()).toBe('partially_filled');
    await engine.assignWorkersToDispatch(ORG, REQ, [M[1]]);
    expect(await requestStatus()).toBe('filled');
    expect(await reason(engine.assignWorkersToDispatch(ORG, REQ, [M[2]]))).toBe('not_open');
    expect(await assignments()).toHaveLength(2);
  });

  it('refuses more workers than the request needs, writing nothing', async () => {
    await request('open', 2);
    expect(await reason(engine.assignWorkersToDispatch(ORG, REQ, [M[0], M[1], M[2]]))).toBe('over_capacity');
    expect(await assignments()).toEqual([]);
    expect(await requestStatus()).toBe('open');
  });

  it('refuses a worker already on the request, and offers a repeated id once', async () => {
    await request('open', 3);
    await engine.assignWorkersToDispatch(ORG, REQ, [M[0], M[0]]);
    expect(await assignments()).toHaveLength(1);
    expect(await reason(engine.assignWorkersToDispatch(ORG, REQ, [M[0]]))).toBe('already_assigned');
    expect(await assignments()).toHaveLength(1);
  });

  it('refuses a suspended member, an unknown id and another organization\u2019s member, writing nothing', async () => {
    await request('open', 3);
    for (const id of [M[3], '66666666-6666-4666-8666-666666666666', OTHER_ORG_MEMBER]) {
      expect(await reason(engine.assignWorkersToDispatch(ORG, REQ, [M[0], id])), id).toBe('not_members');
    }
    expect(await assignments()).toEqual([]);
  });

  it.each(['filled', 'cancelled', 'expired'])('refuses a %s request', async (status) => {
    await request(status, 2);
    expect(await reason(engine.assignWorkersToDispatch(ORG, REQ, [M[0]]))).toBe('not_open');
    expect(await assignments()).toEqual([]);
  });

  it('does not see another organization\u2019s request', async () => {
    await request('open', 2, OTHER_ORG);
    expect(await reason(engine.assignWorkersToDispatch(ORG, REQ, [M[0]]))).toBe('not_found');
    expect(await assignments()).toEqual([]);
  });
});

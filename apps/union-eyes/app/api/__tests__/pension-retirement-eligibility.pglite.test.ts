import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { pensionMembers } from '@/db/schema';
import { createTableDatabase } from './support/pglite-tables';

// DEF-0B10-PEN-RETIREMENT-ELIGIBILITY-LISTS-EVERY-PENSION-ENROLMENT-OF-THE-ORGANIZATION-TO-ANY-MEMBER

const state = vi.hoisted(() => ({ db: null as unknown, config: null as unknown }));
const audit = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => undefined));

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(state.db),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: audit }));
vi.mock('@/lib/api/framework', async () => {
  const { z } = await import('zod');
  const make = (status: number) => (msg: string) => Object.assign(new Error(msg), { status });
  return {
    z,
    withApi: (cfg: unknown, handler: (c: unknown) => Promise<unknown>) => {
      state.config = cfg;
      return (c: unknown) => handler(c);
    },
    ApiError: { badRequest: make(400) },
  };
});

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const PLAN = '33333333-3333-4333-8333-333333333333';

let pg: PGlite;

async function enrol(org: string, name: string, years: string) {
  await pg.query(
    `INSERT INTO pension_members (organization_id, plan_id, user_id, name, plan_name, years_of_service, metadata)
     VALUES ($1, $2, gen_random_uuid(), $3, 'Plan', $4, '{"sin":"123-456-789"}')`,
    [org, PLAN, name, years],
  );
}

const call = async (organizationId: string | undefined, query = '') => {
  const { GET } = await import('../pension/retirement-eligibility/route');
  return (GET as any)({ request: new Request(`http://localhost/api/pension/retirement-eligibility${query}`), organizationId, userId: 'officer-1' });
};

beforeAll(async () => {
  const created = await createTableDatabase([pensionMembers]);
  pg = created.pg;
  state.db = created.db;
});
afterAll(async () => { await pg.close(); });

beforeEach(async () => {
  audit.mockClear();
  await pg.exec('TRUNCATE pension_members');
  await enrol(ORG_A, 'Alice', '31.0');
  await enrol(ORG_A, 'Bob', '12.0');
  await enrol(ORG_A, 'Cara', '25.0');
  await enrol(ORG_B, 'Other Org Member', '40.0');
});

describe('GET /api/pension/retirement-eligibility', () => {
  it('requires at least an officer, not the member floor', async () => {
    await import('../pension/retirement-eligibility/route');
    expect((state.config as { auth: { minRole: string } }).auth.minRole).toBe('officer');
  });

  it('lists only the caller organization at the stated threshold, most service first, and says it is not an eligibility determination', async () => {
    const result = await call(ORG_A, '?threshold=25');
    expect(result.data.map((r: { name: string }) => r.name)).toEqual(['Alice', 'Cara']);
    expect(result.threshold).toBe(25);
    expect(result.basis).toBe('YEARS_OF_SERVICE_FILTER_NOT_AN_ELIGIBILITY_DETERMINATION');
  });

  it('requires the threshold instead of applying a silent default of 25', async () => {
    await expect(call(ORG_A)).rejects.toMatchObject({ status: 400 });
    expect(audit).not.toHaveBeenCalled();
  });

  it('never returns another organization\'s enrolment even for a low threshold', async () => {
    const result = await call(ORG_A, '?threshold=1');
    expect(result.data.map((r: { name: string }) => r.name)).not.toContain('Other Org Member');
    expect(result.data).toHaveLength(3);
  });

  it('returns an allow-listed projection with no user id, plan id or metadata', async () => {
    const [row] = (await call(ORG_A, '?threshold=25')).data;
    expect(Object.keys(row).sort()).toEqual(['enrollmentDate', 'id', 'membershipStatus', 'name', 'planName', 'vestingStatus', 'yearsOfService']);
    expect(JSON.stringify(row)).not.toContain('123-456-789');
  });

  it.each(['?threshold=0', '?threshold=61', '?threshold=abc', '?threshold=-3'])('rejects %s', async (q) => {
    await expect(call(ORG_A, q)).rejects.toMatchObject({ status: 400 });
    expect(audit).not.toHaveBeenCalled();
  });

  it('refuses a request with no organization context', async () => {
    await expect(call(undefined)).rejects.toMatchObject({ status: 400 });
  });

  it('records who read the list in the same transaction', async () => {
    await call(ORG_A, '?threshold=25');
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0][1]).toMatchObject({
      organizationId: ORG_A,
      userId: 'officer-1',
      action: 'pension.retirement_eligibility.read',
      details: { threshold: 25, rows: 2 },
    });
  });
});

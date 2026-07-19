/**
 * Member Employment Queries — Unit Tests
 *
 * Same withRLSContext + drizzle-builder queue mock as the other db/queries
 * suites (chain methods all return chain; chain.then resolves queue.shift(),
 * Error => reject). Each exported fn is driven through its happy path; a few
 * representative catch branches are exercised by pushing an Error.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ queue: [] as unknown[] }));

function makeChain() {
  const chain: Record<string, unknown> = {};
  for (const m of [
    'from',
    'where',
    'orderBy',
    'limit',
    'offset',
    'values',
    'set',
    'returning',
    '$dynamic',
  ]) {
    chain[m] = () => chain;
  }
  (chain as { then: unknown }).then = (
    resolve: (v: unknown) => unknown,
    reject: (e: unknown) => unknown,
  ) => {
    const v = mocks.queue.length ? mocks.queue.shift() : [];
    if (v instanceof Error) return Promise.reject(v).then(resolve, reject);
    return Promise.resolve(v).then(resolve, reject);
  };
  return chain;
}
function makeTx() {
  return {
    select: () => makeChain(),
    insert: () => makeChain(),
    update: () => makeChain(),
    delete: () => makeChain(),
  };
}

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (op: (tx: unknown) => Promise<unknown>) => op(makeTx()),
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import * as q from '../member-employment-queries';

function push(...rows: unknown[]) {
  mocks.queue.push(...rows);
}

beforeEach(() => {
  mocks.queue = [];
  vi.clearAllMocks();
});

describe('member-employment-queries — employment records', () => {
  it('createMemberEmployment returns the created row', async () => {
    push([{ id: 'e1', memberId: 'm1', jobTitle: 'Welder' }]);
    expect(await q.createMemberEmployment({ memberId: 'm1' } as never)).toEqual({
      id: 'e1',
      memberId: 'm1',
      jobTitle: 'Welder',
    });
  });
  it('createMemberEmployment rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.createMemberEmployment({} as never)).rejects.toThrow(
      'Failed to create member employment',
    );
  });

  it('getMemberEmploymentById returns row or null', async () => {
    push([{ id: 'e1' }]);
    expect(await q.getMemberEmploymentById('e1')).toEqual({ id: 'e1' });
    push([]);
    expect(await q.getMemberEmploymentById('missing')).toBeNull();
  });
  it('getMemberEmploymentById rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.getMemberEmploymentById('e1')).rejects.toThrow('Failed to fetch member employment');
  });

  it('getActiveMemberEmployment returns row or null', async () => {
    push([{ id: 'e1' }]);
    expect(await q.getActiveMemberEmployment('m1')).toEqual({ id: 'e1' });
    push([]);
    expect(await q.getActiveMemberEmployment('m1')).toBeNull();
  });

  it('getAllMemberEmployment returns rows', async () => {
    push([{ id: 'e1' }, { id: 'e2' }]);
    expect(await q.getAllMemberEmployment('m1')).toHaveLength(2);
  });

  it('getEmploymentByOrganization with and without status', async () => {
    push([{ id: 'e1' }]);
    expect(await q.getEmploymentByOrganization('org', 'active')).toHaveLength(1);
    push([{ id: 'e1' }]);
    expect(await q.getEmploymentByOrganization('org')).toHaveLength(1);
  });

  it('updateMemberEmployment returns the updated row', async () => {
    push([{ id: 'e1' }]);
    expect(await q.updateMemberEmployment('e1', {} as never)).toEqual({ id: 'e1' });
  });

  it('deleteMemberEmployment resolves', async () => {
    push([]);
    await expect(q.deleteMemberEmployment('e1')).resolves.toBeUndefined();
  });

  it('getEmploymentForDuesCalculation maps compensation fields', async () => {
    push([
      {
        grossWages: '1000.50',
        baseSalary: '52000',
        hourlyRate: '25',
        regularHoursPerPeriod: '40',
        employmentStatus: 'active',
        payFrequency: 'monthly',
      },
    ]);
    const r = await q.getEmploymentForDuesCalculation('m1');
    expect(r).toEqual({
      grossWages: 1000.5,
      baseSalary: 52000,
      hourlyRate: 25,
      hoursWorked: 40,
      employmentStatus: 'active',
      payFrequency: 'monthly',
    });
  });
  it('getEmploymentForDuesCalculation returns null when no active employment', async () => {
    push([]);
    expect(await q.getEmploymentForDuesCalculation('m1')).toBeNull();
  });
});

describe('member-employment-queries — history & leaves', () => {
  it('createEmploymentHistory returns the created row', async () => {
    push([{ id: 'h1', memberId: 'm1', changeType: 'promotion' }]);
    expect(await q.createEmploymentHistory({ memberId: 'm1' } as never)).toEqual({
      id: 'h1',
      memberId: 'm1',
      changeType: 'promotion',
    });
  });
  it('getEmploymentHistoryByMember returns rows', async () => {
    push([{ id: 'h1' }]);
    expect(await q.getEmploymentHistoryByMember('m1')).toHaveLength(1);
  });

  it('createMemberLeave returns the created row', async () => {
    push([{ id: 'l1', memberId: 'm1', leaveType: 'medical' }]);
    expect(await q.createMemberLeave({ memberId: 'm1' } as never)).toEqual({
      id: 'l1',
      memberId: 'm1',
      leaveType: 'medical',
    });
  });
  it('getActiveMemberLeaves with explicit and default date', async () => {
    push([{ id: 'l1' }]);
    expect(await q.getActiveMemberLeaves('m1', new Date('2025-01-01'))).toHaveLength(1);
    push([{ id: 'l1' }]);
    expect(await q.getActiveMemberLeaves('m1')).toHaveLength(1);
  });
  it('getAllMemberLeaves returns rows', async () => {
    push([{ id: 'l1' }]);
    expect(await q.getAllMemberLeaves('m1')).toHaveLength(1);
  });
  it('updateMemberLeave returns the updated row', async () => {
    push([{ id: 'l1' }]);
    expect(await q.updateMemberLeave('l1', {} as never)).toEqual({ id: 'l1' });
  });
});

describe('member-employment-queries — job classifications & seniority', () => {
  it('createJobClassification returns the created row', async () => {
    push([{ id: 'jc1', jobCode: 'W1', jobTitle: 'Welder' }]);
    expect(await q.createJobClassification({ jobCode: 'W1' } as never)).toEqual({
      id: 'jc1',
      jobCode: 'W1',
      jobTitle: 'Welder',
    });
  });
  it('getJobClassificationByCode returns row or null', async () => {
    push([{ id: 'jc1' }]);
    expect(await q.getJobClassificationByCode('org', 'W1')).toEqual({ id: 'jc1' });
    push([]);
    expect(await q.getJobClassificationByCode('org', 'missing')).toBeNull();
  });
  it('getJobClassificationsByOrganization with activeOnly true and false', async () => {
    push([{ id: 'jc1' }]);
    expect(await q.getJobClassificationsByOrganization('org')).toHaveLength(1);
    push([{ id: 'jc1' }, { id: 'jc2' }]);
    expect(await q.getJobClassificationsByOrganization('org', false)).toHaveLength(2);
  });
  it('updateJobClassification returns the updated row', async () => {
    push([{ id: 'jc1' }]);
    expect(await q.updateJobClassification('jc1', {} as never)).toEqual({ id: 'jc1' });
  });

  it('calculateSeniorityYears without memberId (pure date math)', async () => {
    const seniority = new Date('2020-01-01');
    const now = new Date('2025-01-01');
    const years = await q.calculateSeniorityYears(seniority, now);
    expect(years).toBeCloseTo(5, 0);
  });
  it('calculateSeniorityYears subtracts seniority-affecting leave days', async () => {
    push([
      { affectsSeniority: true, seniorityAdjustmentDays: 365 },
      { affectsSeniority: false, seniorityAdjustmentDays: 100 },
    ]);
    const seniority = new Date('2020-01-01');
    const now = new Date('2025-01-01');
    const years = await q.calculateSeniorityYears(seniority, now, 'm1');
    expect(years).toBeCloseTo(4, 0);
  });
  it('calculateSeniorityYears clamps to zero', async () => {
    const future = new Date('2030-01-01');
    const now = new Date('2025-01-01');
    expect(await q.calculateSeniorityYears(future, now)).toBe(0);
  });
});

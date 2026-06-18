import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  queue: [] as unknown[],
  recordMemoryEvent: vi.fn(),
  computeCaseRisk: vi.fn(() => ({ risk: 'high' })),
  computeStewardWorkload: vi.fn(() => ({ load: 0.5 })),
}));

function chain() {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'from', 'where', 'limit', 'orderBy']) {
    c[m] = vi.fn(() => c);
  }
  (c as { then: (r: (v: unknown) => void) => void }).then = (resolve) => {
    resolve(h.queue.shift() ?? []);
  };
  return c;
}

vi.mock('@/db/db', () => ({ db: { select: vi.fn(() => chain()) } }));

vi.mock('drizzle-orm', () => ({
  and: vi.fn(() => 'and'),
  desc: vi.fn(() => 'desc'),
  eq: vi.fn(() => 'eq'),
  gte: vi.fn(() => 'gte'),
  sql: vi.fn(() => 'sql'),
}));

vi.mock('@nzila/platform-cognition-core', () => ({
  memory: { recordMemoryEvent: h.recordMemoryEvent },
}));

vi.mock('@nzila/ue-cognition', () => ({
  computeCaseRisk: h.computeCaseRisk,
  computeStewardWorkload: h.computeStewardWorkload,
}));

vi.mock('@/db/schema/domains/claims/grievances', () => ({
  grievances: { id: 'id', organizationId: 'orgId', updatedAt: 'updatedAt' },
}));
vi.mock('@/db/schema/domains/claims/grievance-lifecycle', () => ({
  grievanceEvents: { id: 'id', eventType: 'eventType', createdAt: 'createdAt', grievanceId: 'grievanceId' },
}));
vi.mock('@/db/schema/domains/member/stewards', () => ({
  stewards: {
    id: 'id', userId: 'userId', currentCaseload: 'cur', maxCaseload: 'max',
    orgId: 'orgId', active: 'active',
  },
  stewardAssignments: { grievanceId: 'grievanceId', stewardId: 'stewardId' },
}));

import {
  caseSubject,
  memberSubject,
  scoreGrievanceRisk,
  scoreOrgRecentCases,
  scoreStewardWorkloads,
  stewardSubject,
} from '../ue-adapter';

beforeEach(() => {
  h.queue = [];
  h.recordMemoryEvent.mockReset();
  h.computeCaseRisk.mockReset().mockReturnValue({ risk: 'high' });
  h.computeStewardWorkload.mockReset().mockReturnValue({ load: 0.5 });
});

describe('subject builders', () => {
  it('build subjects for case, steward and member', () => {
    expect(caseSubject('o', 'c').entityType).toBe('grievance');
    expect(stewardSubject('o', 's').entityType).toBe('steward');
    expect(memberSubject('o', 'm').entityType).toBe('member');
  });
});

describe('scoreGrievanceRisk', () => {
  it('returns null when grievance not found', async () => {
    h.queue = [[]];
    expect(await scoreGrievanceRisk('o', 'g')).toBeNull();
  });

  it('scores risk, records memory events and resolves workload', async () => {
    h.queue = [
      [{ id: 'g1', unionRepId: 'rep1', status: 'open', step: 2, filedDate: new Date(), responseDeadline: new Date() }],
      [
        { id: 'e1', eventType: 'sla_missed', createdAt: new Date() },
        { id: 'e2', eventType: 'settled', createdAt: new Date() },
        { id: 'e3', eventType: 'escalated', createdAt: new Date() },
        { id: 'e4', eventType: null, createdAt: null },
      ],
      [{ current: 3, max: 6 }], // steward workload
    ];
    const result = await scoreGrievanceRisk('o', 'g1');
    expect(result).toEqual({ risk: 'high' });
    expect(h.recordMemoryEvent).toHaveBeenCalledTimes(4);
    const input = h.computeCaseRisk.mock.calls[0][0];
    expect(input.assignedStewardWorkloadRatio).toBeCloseTo(0.5);
    expect(input.events.length).toBe(4);
  });

  it('tolerates memory record failures and missing steward', async () => {
    h.recordMemoryEvent.mockImplementation(() => { throw new Error('dup'); });
    h.queue = [
      [{ id: 'g2', unionRepId: null, incidentDate: new Date() }],
      [{ id: 'e1', eventType: 'rejected', createdAt: new Date() }],
    ];
    const result = await scoreGrievanceRisk('o', 'g2');
    expect(result).toEqual({ risk: 'high' });
    expect(h.computeCaseRisk.mock.calls[0][0].assignedStewardWorkloadRatio).toBeNull();
  });
});

describe('scoreStewardWorkloads', () => {
  it('computes workload per active steward', async () => {
    h.queue = [
      [
        { stewardId: 's1', userId: 'u1', current: 2, max: 5 },
        { stewardId: 's2', userId: 'u2', current: null, max: null },
      ],
      [{ grievanceId: 'g1' }, { grievanceId: null }], // s1 assignments
      [], // s2 assignments
    ];
    const out = await scoreStewardWorkloads('o');
    expect(out.length).toBe(2);
    expect(h.computeStewardWorkload).toHaveBeenCalledTimes(2);
    expect(h.computeStewardWorkload.mock.calls[0][0].assignedCaseIds).toEqual(['g1']);
  });
});

describe('scoreOrgRecentCases', () => {
  it('scores each recent grievance, skipping nulls', async () => {
    h.queue = [
      [{ id: 'g1' }, { id: 'g2' }], // recent grievances
      // g1 -> scoreGrievanceRisk: found + events + no rep
      [{ id: 'g1', unionRepId: null, filedDate: new Date() }],
      [],
      // g2 -> not found (null)
      [],
    ];
    const out = await scoreOrgRecentCases('o', 30);
    expect(out.length).toBe(1);
  });
});

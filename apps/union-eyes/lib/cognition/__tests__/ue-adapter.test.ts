import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  queue: [] as unknown[],
  contexts: [] as Array<{ organizationId: string }>,
  /** The where condition of every select, in order, with the context it ran in (null: outside any). */
  statements: [] as Array<{ where: unknown; context: string | null }>,
  activeContext: { current: null as string | null },
  recordMemoryEvent: vi.fn(),
  computeCaseRisk: vi.fn(() => ({ risk: 'high' })),
  computeStewardWorkload: vi.fn(() => ({ load: 0.5 })),
}));

function chain() {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'from', 'limit', 'orderBy']) {
    c[m] = vi.fn(() => c);
  }
  c.where = vi.fn((condition: unknown) => {
    h.statements.push({ where: condition, context: h.activeContext.current });
    return c;
  });
  (c as { then: (r: (v: unknown) => void) => void }).then = (resolve) => {
    resolve(h.queue.shift() ?? []);
  };
  return c;
}

// The adapter reads only through the transaction of the organization's context; the module-level handle must not be loaded.
vi.mock('@/db/db', () => {
  throw new Error('the cognition adapter must not use the module-level database handle');
});
vi.mock('@/db', () => {
  throw new Error('the cognition adapter must not use the module-level database handle');
});
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (context: { organizationId: string }, work: (tx: unknown) => Promise<unknown>) => {
    h.contexts.push(context);
    const outer = h.activeContext.current;
    h.activeContext.current = context.organizationId;
    try {
      return await work({ select: vi.fn(() => chain()) });
    } finally {
      h.activeContext.current = outer;
    }
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...conditions: unknown[]) => ({ and: conditions })),
  desc: vi.fn(() => 'desc'),
  eq: vi.fn((column: unknown, value: unknown) => ({ eq: [column, value] })),
  gte: vi.fn(() => 'gte'),
  sql: vi.fn(() => 'sql'),
  isNull: vi.fn((column: unknown) => ({ isNull: column })),
  relations: vi.fn(() => ({})),
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
}));
vi.mock('@/db/schema/union-structure-schema', () => ({
  stewardAssignments: { grievanceId: 'grievanceId', stewardId: 'stewardId', organizationId: 'assignmentOrgId' },
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
  h.contexts.length = 0;
  h.statements.length = 0;
  h.activeContext.current = null;
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

  it('reads the grievance in the organization and only the grievance of that organization', async () => {
    h.queue = [[]];

    await scoreGrievanceRisk('org-1', 'g1');

    expect(h.contexts).toEqual([{ organizationId: 'org-1' }]);
    expect(h.statements).toEqual([
      { where: { and: [{ eq: ['id', 'g1'] }, { eq: ['orgId', 'org-1'] }, { isNull: undefined }] }, context: 'org-1' },
    ]);
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
    // grievance, events and steward are three statements of the one context
    expect(h.contexts).toHaveLength(1);
    expect(h.statements.filter((statement) => statement.where !== undefined && statement.context === 'o')).toHaveLength(3);
  });

  it('reads the steward of the case in the same organization', async () => {
    h.queue = [
      [{ id: 'g1', unionRepId: 'rep1', filedDate: new Date() }],
      [],
      [{ current: 1, max: 4 }],
    ];

    await scoreGrievanceRisk('org-1', 'g1');

    expect(h.statements[2].where).toEqual({ and: [{ eq: ['userId', 'rep1'] }, { eq: ['orgId', 'org-1'] }] });
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

  it('does not turn a failed read into a case with no risk', async () => {
    h.queue = [Promise.reject(new Error('connection lost'))];

    await expect(scoreGrievanceRisk('o', 'g1')).rejects.toThrow('connection lost');
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

  it('reads the stewards and their assignments of the organization, in its context', async () => {
    h.queue = [[{ stewardId: 's1', userId: 'u1', current: 2, max: 5 }], []];

    await scoreStewardWorkloads('org-1');

    expect(h.contexts).toEqual([{ organizationId: 'org-1' }]);
    expect(h.statements).toEqual([
      { where: { and: [{ eq: ['orgId', 'org-1'] }, { eq: ['active', true] }] }, context: 'org-1' },
      { where: { and: [{ eq: ['assignmentOrgId', 'org-1'] }, { eq: ['stewardId', 's1'] }] }, context: 'org-1' },
    ]);
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

  it('scores every recent case in one transaction of the organization', async () => {
    h.queue = [
      [{ id: 'g1' }, { id: 'g2' }],
      [{ id: 'g1', unionRepId: null, filedDate: new Date() }],
      [],
      [{ id: 'g2', unionRepId: null, filedDate: new Date() }],
      [],
    ];

    const out = await scoreOrgRecentCases('org-1', 7);

    expect(out).toHaveLength(2);
    expect(h.contexts).toEqual([{ organizationId: 'org-1' }]);
    expect(h.statements.every((statement) => statement.context === 'org-1')).toBe(true);
  });
});

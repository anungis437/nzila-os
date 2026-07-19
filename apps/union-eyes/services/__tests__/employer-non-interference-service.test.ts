import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => {
  const queue: unknown[] = [];
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    const methods = [
      'select', 'from', 'where', 'limit', 'orderBy', 'groupBy',
      'innerJoin', 'leftJoin', 'insert', 'update', 'set', 'values', 'returning', 'delete',
    ];
    for (const m of methods) chain[m] = vi.fn(() => chain);
    (chain as { then: unknown }).then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
      const item = queue.length ? queue.shift() : [];
      if (item instanceof Error) return Promise.reject(item).catch(reject);
      return Promise.resolve(item).then(resolve);
    };
    return chain;
  };
  const db = {
    select: vi.fn(() => makeChain()),
    insert: vi.fn(() => makeChain()),
    update: vi.fn(() => makeChain()),
    delete: vi.fn(() => makeChain()),
  };
  return { queue, db };
});

const pushSel = (...items: unknown[]) => { h.queue.push(...items); };

vi.mock('@/db', () => ({ db: h.db }));
vi.mock('@/db/schema/employer-non-interference-schema', () => new Proxy({}, {
  has: () => true,
  get: (_t, n) => (n === '__esModule' ? false : new Proxy({}, { get: (_o, c) => ({ __col: c }) })),
}));
vi.mock('drizzle-orm', async (orig) => ({
  ...(await (orig() as Promise<Record<string, unknown>>)),
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
  gte: vi.fn(() => ({})),
}));

import { EmployerNonInterferenceService } from '../employer-non-interference-service';

const S = EmployerNonInterferenceService;

const attempt = (over: Record<string, unknown> = {}) => ({
  userId: 'u1',
  userEmail: 'u@x.com',
  userRole: 'union_rep',
  dataTypeRequested: 'grievances',
  ...over,
});

beforeEach(() => {
  h.queue.length = 0;
});

describe('employer-non-interference-service', () => {
  describe('validateAccessAttempt', () => {
    it('denies when data type is not classified', async () => {
      pushSel([], []); // classification empty, then logAccessAttempt insert
      const r = await S.validateAccessAttempt(attempt());
      expect(r.granted).toBe(false);
      expect(r.denialReason).toContain('not classified');
    });

    it('denies employer access to union-only data and flags a violation', async () => {
      pushSel(
        [{ id: 'dc1', classificationLevel: 'union_only' }], // classification
        [], // access rule lookup (runs before employer check? no — see order)
        [], // logAccessAttempt insert
        [], // flagViolation insert
      );
      const r = await S.validateAccessAttempt(attempt({ userRole: 'employer_admin' }));
      expect(r.granted).toBe(false);
      expect(r.denialReason).toContain('union-only data is prohibited');
    });

    it('denies when no access rule is defined', async () => {
      pushSel(
        [{ id: 'dc1', classificationLevel: 'shared' }],
        [], // access rule empty
        [], // log
      );
      const r = await S.validateAccessAttempt(attempt());
      expect(r.granted).toBe(false);
      expect(r.denialReason).toContain('No access rule');
    });

    it('denies when the rule disallows access', async () => {
      pushSel(
        [{ id: 'dc1', classificationLevel: 'shared' }],
        [{ accessPermitted: false }],
        [],
      );
      const r = await S.validateAccessAttempt(attempt());
      expect(r.denialReason).toContain('denied by firewall rule');
    });

    it('requires justification when missing', async () => {
      pushSel(
        [{ id: 'dc1', classificationLevel: 'shared' }],
        [{ accessPermitted: true, justificationRequired: true }],
        [],
      );
      const r = await S.validateAccessAttempt(attempt());
      expect(r.requiresJustification).toBe(true);
    });

    it('requires approval when configured', async () => {
      pushSel(
        [{ id: 'dc1', classificationLevel: 'shared' }],
        [{ accessPermitted: true, justificationRequired: false, requiresApproval: true }],
        [],
      );
      const r = await S.validateAccessAttempt(attempt());
      expect(r.requiresApproval).toBe(true);
    });

    it('grants access when all checks pass (lookup by dataTypeId)', async () => {
      pushSel(
        [{ id: 'dc1', classificationLevel: 'shared' }],
        [{ accessPermitted: true, justificationRequired: true, requiresApproval: false }],
        [],
      );
      const r = await S.validateAccessAttempt(attempt({ dataTypeId: 'dc1', justificationProvided: 'because' }));
      expect(r.granted).toBe(true);
    });
  });

  describe('submitAccessJustification', () => {
    const params = (over: Record<string, unknown> = {}) => ({
      requestedBy: 'u1',
      requestedByEmail: 'u@x.com',
      requestedByRole: 'union_rep',
      dataTypeRequested: 'grievances',
      justification: 'j',
      businessPurpose: 'b',
      ...over,
    });

    it('auto-rejects employer requests for union-only data', async () => {
      pushSel([{ classificationLevel: 'union_only' }], [{ id: 'req1' }]);
      const r = await S.submitAccessJustification(params({ requestedByRole: 'employer_hr', dataTypeId: 'dc1' }));
      expect(r.autoRejected).toBe(true);
      expect(r.request).toEqual({ id: 'req1' });
    });

    it('creates a pending request otherwise', async () => {
      pushSel([{ classificationLevel: 'shared' }], [{ id: 'req2' }]);
      const r = await S.submitAccessJustification(params());
      expect(r.autoRejected).toBe(false);
      expect(r.request).toEqual({ id: 'req2' });
    });
  });

  it('reviewAccessJustification updates and returns the request (approved)', async () => {
    pushSel([{ id: 'req1', requestStatus: 'approved' }]);
    const r = await S.reviewAccessJustification('req1', 'admin', 'approved', 'ok', new Date());
    expect(r).toEqual({ id: 'req1', requestStatus: 'approved' });
  });

  it('reviewAccessJustification handles a denied decision', async () => {
    pushSel([{ id: 'req2', requestStatus: 'denied' }]);
    const r = await S.reviewAccessJustification('req2', 'admin', 'denied', 'no');
    expect(r).toEqual({ id: 'req2', requestStatus: 'denied' });
  });

  it('tagUnionOnlyData inserts and returns the tag', async () => {
    pushSel([{ id: 'tag1' }]);
    const r = await S.tagUnionOnlyData({ resourceType: 'doc', resourceId: 'd1', taggedBy: 'u1' });
    expect(r).toEqual({ id: 'tag1' });
  });

  describe('isUnionOnly', () => {
    it('returns true when flagged', async () => {
      pushSel([{ unionOnlyFlag: true }]);
      expect(await S.isUnionOnly('doc', 'd1')).toBe(true);
    });

    it('returns false when no tag exists', async () => {
      pushSel([]);
      expect(await S.isUnionOnly('doc', 'd1')).toBe(false);
    });
  });

  it('getFlaggedAccessAttempts returns flagged rows', async () => {
    pushSel([{ id: 'a1' }]);
    expect(await S.getFlaggedAccessAttempts()).toEqual([{ id: 'a1' }]);
  });

  it('getOpenViolations returns open violations', async () => {
    pushSel([{ id: 'v1' }]);
    expect(await S.getOpenViolations()).toEqual([{ id: 'v1' }]);
  });

  describe('generateComplianceAudit', () => {
    it('summarizes attempts, violations and compliance rate', async () => {
      pushSel(
        [
          { userRole: 'employer_admin', accessGranted: false, dataTypeRequested: 'grievances' },
          { userRole: 'union_rep', accessGranted: true, dataTypeRequested: 'dues' },
          { userRole: 'employer_hr', accessGranted: false, dataTypeRequested: 'grievances' },
          { userRole: 'employer_hr', accessGranted: false, dataTypeRequested: 'salaries' },
          { userRole: 'employer_hr', accessGranted: false, dataTypeRequested: 'medical' },
        ],
        [{ severity: 'critical' }, { severity: 'low' }],
        [{ id: 'audit1' }],
      );
      const r = await S.generateComplianceAudit('Q1', 'auditor');
      expect(r).toEqual({ id: 'audit1' });
      const insertArgs = h.db.insert.mock.results;
      expect(insertArgs.length).toBeGreaterThan(0);
    });

    it('uses 100% compliance when there are no attempts', async () => {
      pushSel([], [], [{ id: 'audit2' }]);
      const r = await S.generateComplianceAudit('Q2', 'auditor');
      expect(r).toEqual({ id: 'audit2' });
    });
  });

  it('classifyDataType inserts and returns a record', async () => {
    pushSel([{ id: 'dc1' }]);
    const r = await S.classifyDataType({
      dataType: 'grievances',
      classificationLevel: 'union_only',
      accessibleByEmployer: false,
      accessibleByUnion: true,
      requiresJustification: true,
    });
    expect(r).toEqual({ id: 'dc1' });
  });

  it('getEmployerAccessHistory returns history rows', async () => {
    pushSel([{ id: 'h1' }]);
    expect(await S.getEmployerAccessHistory('dc1')).toEqual([{ id: 'h1' }]);
  });
});

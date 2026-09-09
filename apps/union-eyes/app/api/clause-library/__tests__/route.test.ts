import { describe, it, expect, beforeEach, vi } from 'vitest';

// Round 55 — POST /api/clause-library must stamp sourceOrganizationId from
// the authenticated caller's organization, never from the request body
// (prior code trusted body.sourceOrganizationId, letting any steward
// create a clause "owned" by an arbitrary organization).

const h = vi.hoisted(() => {
  const queue: unknown[] = [];
  const insertedValues: Record<string, unknown>[] = [];
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'from', 'leftJoin', 'where', 'orderBy', 'limit', 'offset', 'insert', 'returning']) {
      chain[m] = () => chain;
    }
    chain.values = (v: Record<string, unknown>) => {
      insertedValues.push(v);
      return chain;
    };
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      const v = queue.length ? queue.shift() : [];
      return (v instanceof Error ? Promise.reject(v) : Promise.resolve(v)).then(res, rej);
    };
    return chain;
  };
  const db = { select: () => makeChain(), insert: () => makeChain() };
  const withApi = vi.fn();
  const badRequest = vi.fn((msg: string) => ({ apiError: true, status: 400, msg }));
  const buildClauseVisibilityCondition = vi.fn().mockResolvedValue({ op: 'visibility' });
  return { queue, insertedValues, db, withApi, badRequest, buildClauseVisibilityCondition };
});

vi.mock('@/db/db', () => ({ db: h.db }));
vi.mock('@/db/schema/domains/agreements/shared-library', () => ({
  sharedClauseLibrary: { id: 'scl.id', sourceOrganizationId: 'scl.sourceOrganizationId', clauseTitle: 'scl.clauseTitle', clauseText: 'scl.clauseText', clauseType: 'scl.clauseType', sector: 'scl.sector', province: 'scl.province', sharingLevel: 'scl.sharingLevel', expiryDate: 'scl.expiryDate', createdAt: 'scl.createdAt' },
}));
vi.mock('@/db/schema', () => ({ organizations: { id: 'org.id', name: 'org.name' }, congressMemberships: { id: 'cm.id', organizationId: 'cm.organizationId', status: 'cm.status' } }));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  or: vi.fn((...args: unknown[]) => ({ op: 'or', args })),
  ilike: vi.fn((col: unknown, val: unknown) => ({ op: 'ilike', col, val })),
  inArray: vi.fn((col: unknown, val: unknown) => ({ op: 'inArray', col, val })),
  gte: vi.fn((col: unknown, val: unknown) => ({ op: 'gte', col, val })),
  isNull: vi.fn((col: unknown) => ({ op: 'isNull', col })),
  sql: Object.assign(vi.fn(() => ({ op: 'sql' })), { raw: vi.fn() }),
}));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: (fn: () => unknown) => fn() }));
vi.mock('@/lib/api/framework', () => ({ withApi: h.withApi, ApiError: { badRequest: h.badRequest } }));
vi.mock('@/lib/clause-library/sharing-authority', () => ({
  buildClauseVisibilityCondition: h.buildClauseVisibilityCondition,
}));

async function loadHandlers() {
  h.withApi.mockImplementation((_opts: unknown, handler: (ctx: unknown) => unknown) => handler);
  const mod = await import('../route');
  return { POST: mod.POST as unknown as (ctx: unknown) => unknown };
}

describe('POST /api/clause-library (round 55 ownership-spoofing fix)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.queue.length = 0;
    h.insertedValues.length = 0;
    vi.resetModules();
  });

  it('ignores body.sourceOrganizationId and stamps the authenticated organizationId', async () => {
    h.queue.push([{ id: 'clause-new', sourceOrganizationId: 'org-a' }]);
    const { POST } = await loadHandlers();

    const request = {
      json: async () => ({
        clauseTitle: 'Wage clause',
        clauseText: 'text',
        clauseType: 'wages',
        sourceOrganizationId: 'attacker-controlled-org',
      }),
    };

    await POST({ request, organizationId: 'org-a', userId: 'user-1' });

    expect(h.insertedValues[0].sourceOrganizationId).toBe('org-a');
    expect(h.insertedValues[0].sourceOrganizationId).not.toBe('attacker-controlled-org');
  });
});

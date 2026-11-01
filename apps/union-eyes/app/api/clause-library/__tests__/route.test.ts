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
  const forbidden = vi.fn((msg: string) => ({ apiError: true, status: 403, msg }));
  const notFound = vi.fn((r: string) => ({ apiError: true, status: 404, msg: r }));
  const buildClauseVisibilityCondition = vi.fn().mockResolvedValue({ op: 'visibility' });
  const withSystemContext = vi.fn((fn: () => unknown) => fn());
  const withRLSContext = vi.fn((_context: { organizationId: string }, fn: (tx: unknown) => unknown) => fn(db));
  const sharingChangeDenial = vi.fn().mockResolvedValue(null);
  const persistAtomicAudit = vi.fn().mockResolvedValue(undefined);
  return { forbidden, notFound, sharingChangeDenial, persistAtomicAudit, queue, insertedValues, db, withApi, badRequest, buildClauseVisibilityCondition, withSystemContext, withRLSContext };
});

vi.mock('@/db/db', () => ({ db: h.db }));
vi.mock('@/db/schema/domains/agreements/shared-library', () => ({
  sharedClauseLibrary: { id: 'scl.id', sourceOrganizationId: 'scl.sourceOrganizationId', clauseTitle: 'scl.clauseTitle', clauseText: 'scl.clauseText', clauseType: 'scl.clauseType', sector: 'scl.sector', province: 'scl.province', sharingLevel: 'scl.sharingLevel', expiryDate: 'scl.expiryDate', createdAt: 'scl.createdAt' },
}));
vi.mock('@/db/schema', () => ({ organizations: { id: 'org.id', name: 'org.name' }, congressMemberships: { id: 'cm.id', organizationId: 'cm.organizationId', status: 'cm.status' }, collectiveAgreements: { id: 'ca.id', organizationId: 'ca.organizationId' } }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: h.persistAtomicAudit }));
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
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: h.withSystemContext,
  withRLSContext: h.withRLSContext,
}));
vi.mock('@/lib/api/framework', () => ({ withApi: h.withApi, ApiError: { badRequest: h.badRequest, forbidden: h.forbidden, notFound: h.notFound } }));
vi.mock('@/lib/clause-library/sharing-authority', () => ({
  buildClauseVisibilityCondition: h.buildClauseVisibilityCondition,
  sharingChangeDenial: h.sharingChangeDenial,
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

    await POST({ request, organizationId: 'org-a', userId: 'user-1', user: { role: 'officer' } });

    expect(h.insertedValues[0].sourceOrganizationId).toBe('org-a');
    expect(h.insertedValues[0].sourceOrganizationId).not.toBe('attacker-controlled-org');
    expect(h.insertedValues[0].createdBy).toBe('user-1');
    expect(h.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org-a' }, expect.any(Function));
    // System context is only used for the sharing-authority check, never for the insert.
    expect(h.sharingChangeDenial).toHaveBeenCalledWith('org-a', expect.any(Object));
    // The audit row is persisted atomically on the same transaction handle as the insert.
    expect(h.persistAtomicAudit).toHaveBeenCalledTimes(1);
    expect(h.persistAtomicAudit).toHaveBeenCalledWith(
      h.db,
      expect.objectContaining({
        organizationId: 'org-a',
        userId: 'user-1',
        action: 'clause_library.create',
        resourceId: 'clause-new',
      }),
    );
  });

  it('denies create and does not insert or audit when the sharing change is not authorized', async () => {
    h.sharingChangeDenial.mockResolvedValueOnce({ status: 403, message: 'not allowed to share' });
    const { POST } = await loadHandlers();
    const request = {
      json: async () => ({ clauseTitle: 'T', clauseText: 'x', clauseType: 'wages', sharingLevel: 'public' }),
    };

    await expect(POST({ request, organizationId: 'org-a', userId: 'user-1', user: { role: 'officer' } })).rejects.toMatchObject({ status: 403 });
    expect(h.insertedValues).toHaveLength(0);
    expect(h.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('404s without inserting when sourceCbaId does not belong to the caller organization', async () => {
    h.queue.push([]); // org-scoped agreement lookup finds nothing
    const { POST } = await loadHandlers();
    const request = {
      json: async () => ({ clauseTitle: 'T', clauseText: 'x', clauseType: 'wages', sourceCbaId: '00000000-0000-4000-8000-0000000000c1' }),
    };

    await expect(POST({ request, organizationId: 'org-a', userId: 'user-1', user: { role: 'officer' } })).rejects.toMatchObject({ status: 404 });
    expect(h.insertedValues).toHaveLength(0);
    expect(h.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('rejects create when the authenticated user is missing and does not insert', async () => {
    const { POST } = await loadHandlers();
    const request = {
      json: async () => ({
        clauseTitle: 'Wage clause',
        clauseText: 'text',
        clauseType: 'wages',
      }),
    };

    await expect(POST({ request, organizationId: 'org-a', userId: undefined })).rejects.toMatchObject({ status: 400 });
    expect(h.insertedValues).toHaveLength(0);
    expect(h.withRLSContext).not.toHaveBeenCalled();
    expect(h.withSystemContext).not.toHaveBeenCalled();
  });
});

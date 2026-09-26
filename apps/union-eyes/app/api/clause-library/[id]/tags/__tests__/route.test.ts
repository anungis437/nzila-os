import { describe, it, expect, beforeEach, vi } from 'vitest';

// Round 55 — clause_library_tags inherits parent clause READ visibility and
// OWNER-only WRITE authority. DELETE-by-tagId additionally requires the tag
// to belong to the given clause id (tag parent-injection fix).
// Writes use tenant RLS. withSystemContext is not a stand-in for that success.

const h = vi.hoisted(() => {
  const queue: unknown[] = [];
  const insertedValues: Record<string, unknown>[] = [];
  const calls = { insert: 0, delete: 0 };
  const allowPrivilegedRead = { current: false };
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'from', 'where', 'limit', 'returning', 'delete']) {
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
  const db = {
    select: () => makeChain(),
    insert: () => {
      calls.insert += 1;
      return makeChain();
    },
    delete: () => {
      calls.delete += 1;
      return makeChain();
    },
  };
  const withApi = vi.fn();
  const notFound = vi.fn((resource: string, id?: string) => ({ apiError: true, status: 404, resource, id }));
  const badRequest = vi.fn((msg: string) => ({ apiError: true, status: 400, msg }));
  const canReadSharedClause = vi.fn();
  const isSharedClauseOwner = vi.fn();
  const whereSpy = vi.fn();
  const withSystemContext = vi.fn((fn: () => unknown) => {
    if (!allowPrivilegedRead.current) {
      throw new Error('withSystemContext is not tenant mutation authority');
    }
    return fn();
  });
  const withRLSContext = vi.fn((context: { organizationId?: string }, fn: () => unknown) => {
    if (
      typeof context?.organizationId !== 'string' ||
      context.organizationId.trim() === '' ||
      context.organizationId === 'system'
    ) {
      throw new Error('withRLSContext requires a tenant organizationId');
    }
    return fn();
  });
  return {
    queue,
    insertedValues,
    calls,
    allowPrivilegedRead,
    db,
    withApi,
    notFound,
    badRequest,
    canReadSharedClause,
    isSharedClauseOwner,
    whereSpy,
    withSystemContext,
    withRLSContext,
  };
});

vi.mock('@/db/db', () => ({ db: h.db }));
vi.mock('@/db/schema/domains/agreements/shared-library', () => ({
  sharedClauseLibrary: { id: 'scl.id', sourceOrganizationId: 'scl.sourceOrganizationId', sharingLevel: 'scl.sharingLevel', sharedWithOrgIds: 'scl.sharedWithOrgIds' },
  clauseLibraryTags: { id: 'clt.id', clauseId: 'clt.clauseId', tagName: 'clt.tagName' },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
  and: vi.fn((...args: unknown[]) => {
    h.whereSpy(...args);
    return { op: 'and', args };
  }),
}));
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: h.withSystemContext,
  withRLSContext: h.withRLSContext,
}));
vi.mock('@/lib/api/framework', () => ({ withApi: h.withApi, ApiError: { notFound: h.notFound, badRequest: h.badRequest } }));
vi.mock('@/lib/clause-library/sharing-authority', () => ({
  canReadSharedClause: h.canReadSharedClause,
  isSharedClauseOwner: h.isSharedClauseOwner,
}));

const pushSel = (...items: unknown[]) => h.queue.push(...items);

async function loadHandlers() {
  h.withApi.mockImplementation((_opts: unknown, handler: (ctx: unknown) => unknown) => handler);
  const mod = await import('../route');
  return {
    GET: mod.GET as unknown as (ctx: unknown) => unknown,
    POST: mod.POST as unknown as (ctx: unknown) => unknown,
    DELETE: mod.DELETE as unknown as (ctx: unknown) => unknown,
  };
}

const req = (id: string, body: unknown = {}) => ({
  url: `https://example.test/api/clause-library/${id}/tags`,
  json: async () => body,
});

describe('clause-library/[id]/tags route (round 55)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.queue.length = 0;
    h.insertedValues.length = 0;
    h.calls.insert = 0;
    h.calls.delete = 0;
    h.allowPrivilegedRead.current = false;
    vi.resetModules();
  });

  it('GET 404s when the caller cannot read the parent clause', async () => {
    h.allowPrivilegedRead.current = true;
    pushSel([{ id: 'clause-1', sourceOrganizationId: 'org-a', sharingLevel: 'private', sharedWithOrgIds: [] }]);
    h.canReadSharedClause.mockResolvedValue(false);
    const { GET } = await loadHandlers();

    await expect(GET({ request: req('clause-1'), organizationId: 'org-b' })).rejects.toMatchObject({ status: 404 });
    expect(h.withSystemContext).toHaveBeenCalled();
    expect(h.withRLSContext).not.toHaveBeenCalled();
  });

  it('GET returns tags when the caller can read the parent clause (non-owner federation/public reader)', async () => {
    h.allowPrivilegedRead.current = true;
    pushSel([{ id: 'clause-1', sourceOrganizationId: 'org-a', sharingLevel: 'public', sharedWithOrgIds: null }]);
    h.canReadSharedClause.mockResolvedValue(true);
    pushSel([{ id: 'tag-1', tagName: 'wages' }]);
    const { GET } = await loadHandlers();

    const result = (await GET({ request: req('clause-1'), organizationId: 'org-b' })) as { tags: unknown[] };
    expect(result.tags).toEqual([{ id: 'tag-1', tagName: 'wages' }]);
    expect(h.withSystemContext).toHaveBeenCalled();
    expect(h.withRLSContext).not.toHaveBeenCalled();
  });

  it('POST 404s (fails closed) for a non-owner even if they can read the clause', async () => {
    pushSel([{ id: 'clause-1', sourceOrganizationId: 'org-a' }]);
    h.isSharedClauseOwner.mockReturnValue(false);
    const { POST } = await loadHandlers();

    await expect(
      POST({ request: req('clause-1', { tagName: 'benefits' }), organizationId: 'org-b', userId: 'user-b' }),
    ).rejects.toMatchObject({ status: 404 });
    expect(h.calls.insert).toBe(0);
    expect(h.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org-b' }, expect.any(Function));
    expect(h.withSystemContext).not.toHaveBeenCalled();
  });

  it('POST 404s when tenant visibility does not return another organization clause', async () => {
    pushSel([]);
    const { POST } = await loadHandlers();

    await expect(
      POST({ request: req('clause-1', { tagName: 'benefits' }), organizationId: 'org-b', userId: 'user-b' }),
    ).rejects.toMatchObject({ status: 404 });
    expect(h.calls.insert).toBe(0);
    expect(h.isSharedClauseOwner).not.toHaveBeenCalled();
    expect(h.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org-b' }, expect.any(Function));
    expect(h.withSystemContext).not.toHaveBeenCalled();
  });

  it('POST succeeds for the owner and attributes the authenticated user', async () => {
    pushSel([{ id: 'clause-1', sourceOrganizationId: 'org-a' }]);
    h.isSharedClauseOwner.mockReturnValue(true);
    pushSel([{ id: 'tag-1', tagName: 'benefits' }]);
    const { POST } = await loadHandlers();

    const result = (await POST({ request: req('clause-1', { tagName: 'benefits' }), organizationId: 'org-a', userId: 'user-1' })) as { tag: { tagName: string } };
    expect(result.tag.tagName).toBe('benefits');
    expect(h.insertedValues[0].createdBy).toBe('user-1');
    expect(h.insertedValues[0].createdBy).not.toBe('system');
    expect(h.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org-a' }, expect.any(Function));
    expect(h.withSystemContext).not.toHaveBeenCalled();
  });

  it('POST rejects a missing user and does not insert a system actor', async () => {
    const { POST } = await loadHandlers();

    await expect(
      POST({ request: req('clause-1', { tagName: 'benefits' }), organizationId: 'org-a', userId: undefined }),
    ).rejects.toMatchObject({ status: 400 });
    expect(h.calls.insert).toBe(0);
    expect(h.insertedValues).toHaveLength(0);
    expect(h.withRLSContext).not.toHaveBeenCalled();
    expect(h.withSystemContext).not.toHaveBeenCalled();
  });

  it('DELETE by tagId requires BOTH tagId and clauseId to match (tag parent-injection fix)', async () => {
    pushSel([{ id: 'clause-1', sourceOrganizationId: 'org-a' }]);
    h.isSharedClauseOwner.mockReturnValue(true);
    pushSel([]); // delete resolves
    const { DELETE } = await loadHandlers();

    await DELETE({ request: req('clause-1', { tagId: 'tag-from-another-clause' }), organizationId: 'org-a' });

    // and(eq(id, tagId), eq(clauseId, id)) — both predicates present, not tagId alone.
    expect(h.whereSpy).toHaveBeenCalledWith(
      { op: 'eq', col: 'clt.id', val: 'tag-from-another-clause' },
      { op: 'eq', col: 'clt.clauseId', val: 'clause-1' },
    );
    expect(h.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org-a' }, expect.any(Function));
    expect(h.withSystemContext).not.toHaveBeenCalled();
  });

  it('DELETE 404s a non-owner attempting to remove a tag', async () => {
    pushSel([{ id: 'clause-1', sourceOrganizationId: 'org-a' }]);
    h.isSharedClauseOwner.mockReturnValue(false);
    const { DELETE } = await loadHandlers();

    await expect(
      DELETE({ request: req('clause-1', { tagId: 'tag-1' }), organizationId: 'org-b' }),
    ).rejects.toMatchObject({ status: 404 });
    expect(h.calls.delete).toBe(0);
    expect(h.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org-b' }, expect.any(Function));
    expect(h.withSystemContext).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Round 55 — clause_library_tags inherits parent clause READ visibility and
// OWNER-only WRITE authority. DELETE-by-tagId additionally requires the tag
// to belong to the given clause id (tag parent-injection fix).

const h = vi.hoisted(() => {
  const queue: unknown[] = [];
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'from', 'where', 'limit', 'insert', 'values', 'returning', 'delete']) {
      chain[m] = () => chain;
    }
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      const v = queue.length ? queue.shift() : [];
      return (v instanceof Error ? Promise.reject(v) : Promise.resolve(v)).then(res, rej);
    };
    return chain;
  };
  const db = { select: () => makeChain(), insert: () => makeChain(), delete: () => makeChain() };
  const withApi = vi.fn();
  const notFound = vi.fn((resource: string, id?: string) => ({ apiError: true, status: 404, resource, id }));
  const badRequest = vi.fn((msg: string) => ({ apiError: true, status: 400, msg }));
  const canReadSharedClause = vi.fn();
  const isSharedClauseOwner = vi.fn();
  const whereSpy = vi.fn();
  return { queue, db, withApi, notFound, badRequest, canReadSharedClause, isSharedClauseOwner, whereSpy };
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
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: (fn: () => unknown) => fn() }));
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
    vi.resetModules();
  });

  it('GET 404s when the caller cannot read the parent clause', async () => {
    pushSel([{ id: 'clause-1', sourceOrganizationId: 'org-a', sharingLevel: 'private', sharedWithOrgIds: [] }]);
    h.canReadSharedClause.mockResolvedValue(false);
    const { GET } = await loadHandlers();

    await expect(GET({ request: req('clause-1'), organizationId: 'org-b' })).rejects.toMatchObject({ status: 404 });
  });

  it('GET returns tags when the caller can read the parent clause (non-owner federation/public reader)', async () => {
    pushSel([{ id: 'clause-1', sourceOrganizationId: 'org-a', sharingLevel: 'public', sharedWithOrgIds: null }]);
    h.canReadSharedClause.mockResolvedValue(true);
    pushSel([{ id: 'tag-1', tagName: 'wages' }]);
    const { GET } = await loadHandlers();

    const result = (await GET({ request: req('clause-1'), organizationId: 'org-b' })) as { tags: unknown[] };
    expect(result.tags).toEqual([{ id: 'tag-1', tagName: 'wages' }]);
  });

  it('POST 404s (fails closed) for a non-owner even if they can read the clause', async () => {
    pushSel([{ id: 'clause-1', sourceOrganizationId: 'org-a' }]);
    h.isSharedClauseOwner.mockReturnValue(false);
    const { POST } = await loadHandlers();

    await expect(
      POST({ request: req('clause-1', { tagName: 'benefits' }), organizationId: 'org-b' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('POST succeeds for the owner', async () => {
    pushSel([{ id: 'clause-1', sourceOrganizationId: 'org-a' }]);
    h.isSharedClauseOwner.mockReturnValue(true);
    pushSel([{ id: 'tag-1', tagName: 'benefits' }]);
    const { POST } = await loadHandlers();

    const result = (await POST({ request: req('clause-1', { tagName: 'benefits' }), organizationId: 'org-a', userId: 'user-1' })) as { tag: { tagName: string } };
    expect(result.tag.tagName).toBe('benefits');
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
  });

  it('DELETE 404s a non-owner attempting to remove a tag', async () => {
    pushSel([{ id: 'clause-1', sourceOrganizationId: 'org-a' }]);
    h.isSharedClauseOwner.mockReturnValue(false);
    const { DELETE } = await loadHandlers();

    await expect(
      DELETE({ request: req('clause-1', { tagId: 'tag-1' }), organizationId: 'org-b' }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

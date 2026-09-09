import { describe, it, expect, beforeEach, vi } from 'vitest';

// Round 55 — shared_clause_library OWNER_PLUS_EXPLICIT_SHARING_AUTHORITY.
// GET is gated by read-visibility; PATCH/DELETE remain owner-only
// regardless of sharingLevel (broad reader visibility never implies write).

const h = vi.hoisted(() => {
  const queue: unknown[] = [];
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'from', 'leftJoin', 'where', 'limit', 'update', 'set', 'delete', 'returning']) {
      chain[m] = () => chain;
    }
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      const v = queue.length ? queue.shift() : [];
      return (v instanceof Error ? Promise.reject(v) : Promise.resolve(v)).then(res, rej);
    };
    return chain;
  };
  const db = { select: () => makeChain(), update: () => makeChain(), delete: () => makeChain() };
  const withApi = vi.fn();
  const notFound = vi.fn((resource: string, id?: string) => ({ apiError: true, status: 404, resource, id }));
  const canReadSharedClause = vi.fn();
  const isSharedClauseOwner = vi.fn();
  return { queue, db, withApi, notFound, canReadSharedClause, isSharedClauseOwner };
});

vi.mock('@/db/db', () => ({ db: h.db }));
vi.mock('@/db/schema/domains/agreements/shared-library', () => ({
  sharedClauseLibrary: { id: 'scl.id', sourceOrganizationId: 'scl.sourceOrganizationId' },
  clauseLibraryTags: { id: 'clt.id', clauseId: 'clt.clauseId' },
}));
vi.mock('@/db/schema-organizations', () => ({ organizations: { id: 'org.id', name: 'org.name' } }));
vi.mock('drizzle-orm', () => ({ eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })) }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: (fn: () => unknown) => fn() }));
vi.mock('@/lib/api/framework', () => ({ withApi: h.withApi, ApiError: { notFound: h.notFound, badRequest: vi.fn((msg: string) => ({ apiError: true, status: 400, msg })) } }));
vi.mock('@/lib/clause-library/sharing-authority', () => ({
  canReadSharedClause: h.canReadSharedClause,
  isSharedClauseOwner: h.isSharedClauseOwner,
}));

const pushSel = (...items: unknown[]) => h.queue.push(...items);

async function loadHandlers() {
  const captured: Record<string, (ctx: unknown) => unknown> = {};
  h.withApi.mockImplementation((_opts: unknown, handler: (ctx: unknown) => unknown) => handler);
  const mod = await import('../route');
  captured.GET = mod.GET as unknown as (ctx: unknown) => unknown;
  captured.PATCH = mod.PATCH as unknown as (ctx: unknown) => unknown;
  captured.DELETE = mod.DELETE as unknown as (ctx: unknown) => unknown;
  return captured;
}

const req = (id: string, body: unknown = {}) => ({
  url: `https://example.test/api/clause-library/${id}`,
  json: async () => body,
});

describe('clause-library/[id] item route (round 55)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.queue.length = 0;
    vi.resetModules();
  });

  it('GET 404s a clause the caller org is not authorized to read', async () => {
    pushSel([{ id: 'clause-1', sourceOrganizationId: 'org-a', sharingLevel: 'private', sharedWithOrgIds: [] }]);
    h.canReadSharedClause.mockResolvedValue(false);
    const { GET } = await loadHandlers();

    await expect(GET({ request: req('clause-1'), organizationId: 'org-b' })).rejects.toMatchObject({ status: 404 });
  });

  it('GET 404s when the row does not exist', async () => {
    pushSel([]);
    const { GET } = await loadHandlers();

    await expect(GET({ request: req('missing'), organizationId: 'org-b' })).rejects.toMatchObject({ status: 404 });
  });

  it('GET redacts sharedWithOrgIds for a non-owner authorized reader', async () => {
    pushSel([{ id: 'clause-1', sourceOrganizationId: 'org-a', sharingLevel: 'public', sharedWithOrgIds: ['org-b'] }]);
    h.canReadSharedClause.mockResolvedValue(true);
    pushSel([]); // tags
    const { GET } = await loadHandlers();

    const result = (await GET({ request: req('clause-1'), organizationId: 'org-b' })) as { sharedWithOrgIds: unknown; isOwner: boolean };
    expect(result.sharedWithOrgIds).toBeUndefined();
    expect(result.isOwner).toBe(false);
  });

  it('GET includes sharedWithOrgIds for the owner', async () => {
    pushSel([{ id: 'clause-1', sourceOrganizationId: 'org-a', sharingLevel: 'private', sharedWithOrgIds: ['org-b'] }]);
    h.canReadSharedClause.mockResolvedValue(true);
    pushSel([]); // tags
    const { GET } = await loadHandlers();

    const result = (await GET({ request: req('clause-1'), organizationId: 'org-a' })) as { sharedWithOrgIds: unknown; isOwner: boolean };
    expect(result.sharedWithOrgIds).toEqual(['org-b']);
    expect(result.isOwner).toBe(true);
  });

  it('PATCH 404s a non-owner even when they can read the clause (federation/congress/public readers cannot mutate)', async () => {
    pushSel([{ id: 'clause-1', sourceOrganizationId: 'org-a' }]);
    h.isSharedClauseOwner.mockReturnValue(false);
    const { PATCH } = await loadHandlers();

    await expect(
      PATCH({ request: req('clause-1'), organizationId: 'org-b' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('PATCH succeeds for the owner', async () => {
    pushSel([{ id: 'clause-1', sourceOrganizationId: 'org-a' }]);
    h.isSharedClauseOwner.mockReturnValue(true);
    pushSel([{ id: 'clause-1', clauseTitle: 'Updated' }]);
    const { PATCH } = await loadHandlers();

    const result = (await PATCH({ request: req('clause-1', { clauseTitle: 'Updated' }), organizationId: 'org-a' })) as { success: boolean };
    expect(result.success).toBe(true);
  });

  it('DELETE 404s a non-owner', async () => {
    pushSel([{ id: 'clause-1', sourceOrganizationId: 'org-a' }]);
    h.isSharedClauseOwner.mockReturnValue(false);
    const { DELETE } = await loadHandlers();

    await expect(
      DELETE({ request: req('clause-1'), organizationId: 'org-b' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('DELETE succeeds for the owner', async () => {
    pushSel([{ id: 'clause-1', sourceOrganizationId: 'org-a' }]);
    h.isSharedClauseOwner.mockReturnValue(true);
    pushSel([{ id: 'clause-1' }]);
    const { DELETE } = await loadHandlers();

    const result = (await DELETE({ request: req('clause-1'), organizationId: 'org-a' })) as { success: boolean };
    expect(result.success).toBe(true);
  });
});

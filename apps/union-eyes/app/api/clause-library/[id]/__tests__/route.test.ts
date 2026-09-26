import { describe, it, expect, beforeEach, vi } from 'vitest';

// Round 55 — shared_clause_library OWNER_PLUS_EXPLICIT_SHARING_AUTHORITY.
// GET is gated by read-visibility (system role: federation/congress are not
// in ue_shared_library_select). PATCH/DELETE are owner-only tenant writes.
// withSystemContext must not stand in for tenant mutation success.

const h = vi.hoisted(() => {
  const queue: unknown[] = [];
  const updatePayloads: Record<string, unknown>[] = [];
  const calls = { update: 0, delete: 0 };
  const allowPrivilegedRead = { current: false };
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'from', 'leftJoin', 'where', 'limit', 'returning']) {
      chain[m] = () => chain;
    }
    chain.set = (v: Record<string, unknown>) => {
      updatePayloads.push(v);
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
    update: () => {
      calls.update += 1;
      return makeChain();
    },
    delete: () => {
      calls.delete += 1;
      return makeChain();
    },
  };
  const withApi = vi.fn();
  const notFound = vi.fn((resource: string, id?: string) => ({ apiError: true, status: 404, resource, id }));
  const canReadSharedClause = vi.fn();
  const isSharedClauseOwner = vi.fn();
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
    updatePayloads,
    calls,
    allowPrivilegedRead,
    db,
    withApi,
    notFound,
    canReadSharedClause,
    isSharedClauseOwner,
    withSystemContext,
    withRLSContext,
  };
});

vi.mock('@/db/db', () => ({ db: h.db }));
vi.mock('@/db/schema/domains/agreements/shared-library', () => ({
  sharedClauseLibrary: { id: 'scl.id', sourceOrganizationId: 'scl.sourceOrganizationId' },
  clauseLibraryTags: { id: 'clt.id', clauseId: 'clt.clauseId' },
}));
vi.mock('@/db/schema-organizations', () => ({ organizations: { id: 'org.id', name: 'org.name' } }));
vi.mock('drizzle-orm', () => ({ eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })) }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: h.withSystemContext,
  withRLSContext: h.withRLSContext,
}));
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
    h.updatePayloads.length = 0;
    h.calls.update = 0;
    h.calls.delete = 0;
    h.allowPrivilegedRead.current = false;
    vi.resetModules();
  });

  it('GET 404s a clause the caller org is not authorized to read', async () => {
    h.allowPrivilegedRead.current = true;
    pushSel([{ id: 'clause-1', sourceOrganizationId: 'org-a', sharingLevel: 'private', sharedWithOrgIds: [] }]);
    h.canReadSharedClause.mockResolvedValue(false);
    const { GET } = await loadHandlers();

    await expect(GET({ request: req('clause-1'), organizationId: 'org-b' })).rejects.toMatchObject({ status: 404 });
    expect(h.withSystemContext).toHaveBeenCalled();
    expect(h.withRLSContext).not.toHaveBeenCalled();
  });

  it('GET 404s when the row does not exist', async () => {
    h.allowPrivilegedRead.current = true;
    pushSel([]);
    const { GET } = await loadHandlers();

    await expect(GET({ request: req('missing'), organizationId: 'org-b' })).rejects.toMatchObject({ status: 404 });
  });

  it('GET redacts sharedWithOrgIds for a non-owner authorized reader', async () => {
    h.allowPrivilegedRead.current = true;
    pushSel([{ id: 'clause-1', sourceOrganizationId: 'org-a', sharingLevel: 'public', sharedWithOrgIds: ['org-b'] }]);
    h.canReadSharedClause.mockResolvedValue(true);
    pushSel([]); // tags
    const { GET } = await loadHandlers();

    const result = (await GET({ request: req('clause-1'), organizationId: 'org-b' })) as { sharedWithOrgIds: unknown; isOwner: boolean };
    expect(result.sharedWithOrgIds).toBeUndefined();
    expect(result.isOwner).toBe(false);
    expect(h.withSystemContext).toHaveBeenCalled();
    expect(h.withRLSContext).not.toHaveBeenCalled();
  });

  it('GET includes sharedWithOrgIds for the owner', async () => {
    h.allowPrivilegedRead.current = true;
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
      PATCH({ request: req('clause-1', { clauseTitle: 'Stolen' }), organizationId: 'org-b' }),
    ).rejects.toMatchObject({ status: 404 });
    expect(h.calls.update).toBe(0);
    expect(h.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org-b' }, expect.any(Function));
    expect(h.withSystemContext).not.toHaveBeenCalled();
  });

  it('PATCH 404s when tenant visibility does not return another organization clause', async () => {
    pushSel([]);
    const { PATCH } = await loadHandlers();

    await expect(
      PATCH({ request: req('clause-1', { clauseTitle: 'Stolen' }), organizationId: 'org-b' }),
    ).rejects.toMatchObject({ status: 404 });
    expect(h.calls.update).toBe(0);
    expect(h.isSharedClauseOwner).not.toHaveBeenCalled();
    expect(h.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org-b' }, expect.any(Function));
    expect(h.withSystemContext).not.toHaveBeenCalled();
  });

  it('PATCH succeeds for the owner and ignores a body organization id', async () => {
    pushSel([{ id: 'clause-1', sourceOrganizationId: 'org-a' }]);
    h.isSharedClauseOwner.mockReturnValue(true);
    pushSel([{ id: 'clause-1', clauseTitle: 'Updated' }]);
    const { PATCH } = await loadHandlers();

    const result = (await PATCH({
      request: req('clause-1', { clauseTitle: 'Updated', sourceOrganizationId: 'attacker-controlled-org' }),
      organizationId: 'org-a',
    })) as { success: boolean };
    expect(result.success).toBe(true);
    expect(h.updatePayloads[0].clauseTitle).toBe('Updated');
    expect(h.updatePayloads[0].sourceOrganizationId).toBeUndefined();
    expect(h.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org-a' }, expect.any(Function));
    expect(h.withSystemContext).not.toHaveBeenCalled();
  });

  it('DELETE 404s a non-owner', async () => {
    pushSel([{ id: 'clause-1', sourceOrganizationId: 'org-a' }]);
    h.isSharedClauseOwner.mockReturnValue(false);
    const { DELETE } = await loadHandlers();

    await expect(
      DELETE({ request: req('clause-1'), organizationId: 'org-b' }),
    ).rejects.toMatchObject({ status: 404 });
    expect(h.calls.delete).toBe(0);
    expect(h.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org-b' }, expect.any(Function));
    expect(h.withSystemContext).not.toHaveBeenCalled();
  });

  it('DELETE 404s when tenant visibility does not return another organization clause', async () => {
    pushSel([]);
    const { DELETE } = await loadHandlers();

    await expect(
      DELETE({ request: req('clause-1'), organizationId: 'org-b' }),
    ).rejects.toMatchObject({ status: 404 });
    expect(h.calls.delete).toBe(0);
    expect(h.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org-b' }, expect.any(Function));
    expect(h.withSystemContext).not.toHaveBeenCalled();
  });

  it('DELETE succeeds for the owner', async () => {
    pushSel([{ id: 'clause-1', sourceOrganizationId: 'org-a' }]);
    h.isSharedClauseOwner.mockReturnValue(true);
    pushSel([{ id: 'clause-1' }]);
    const { DELETE } = await loadHandlers();

    const result = (await DELETE({ request: req('clause-1'), organizationId: 'org-a' })) as { success: boolean };
    expect(result.success).toBe(true);
    expect(h.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org-a' }, expect.any(Function));
    expect(h.withSystemContext).not.toHaveBeenCalled();
  });
});

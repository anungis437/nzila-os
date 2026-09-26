import { describe, it, expect, beforeEach, vi } from 'vitest';

// Owner-only sharing reads and writes run in the caller's tenant RLS context.
// withSystemContext executing the callback is not treated as tenant success.

const h = vi.hoisted(() => {
  const queue: unknown[] = [];
  const updatePayloads: Record<string, unknown>[] = [];
  const calls = { update: 0 };
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'from', 'where', 'limit', 'returning']) {
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
  };
  const withApi = vi.fn();
  const notFound = vi.fn((resource: string, id?: string) => ({ apiError: true, status: 404, resource, id }));
  const badRequest = vi.fn((msg: string) => ({ apiError: true, status: 400, msg }));
  const isSharedClauseOwner = vi.fn();
  const withSystemContext = vi.fn(() => {
    throw new Error('withSystemContext is not tenant mutation authority');
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
    db,
    withApi,
    notFound,
    badRequest,
    isSharedClauseOwner,
    withSystemContext,
    withRLSContext,
  };
});

vi.mock('@/db/db', () => ({ db: h.db }));
vi.mock('@/db/schema/domains/agreements/shared-library', () => ({
  sharedClauseLibrary: {
    id: 'scl.id',
    sharingLevel: 'scl.sharingLevel',
    sharedWithOrgIds: 'scl.sharedWithOrgIds',
    isAnonymized: 'scl.isAnonymized',
    anonymizedEmployerName: 'scl.anonymizedEmployerName',
    sourceOrganizationId: 'scl.sourceOrganizationId',
  },
}));
vi.mock('drizzle-orm', () => ({ eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })) }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: h.withSystemContext,
  withRLSContext: h.withRLSContext,
}));
vi.mock('@/lib/api/framework', () => ({
  withApi: h.withApi,
  ApiError: { notFound: h.notFound, badRequest: h.badRequest },
}));
vi.mock('@/lib/clause-library/sharing-authority', () => ({
  isSharedClauseOwner: h.isSharedClauseOwner,
}));

const pushSel = (...items: unknown[]) => h.queue.push(...items);

async function loadHandlers() {
  h.withApi.mockImplementation((_opts: unknown, handler: (ctx: unknown) => unknown) => handler);
  const mod = await import('../route');
  return {
    GET: mod.GET as unknown as (ctx: unknown) => unknown,
    POST: mod.POST as unknown as (ctx: unknown) => unknown,
  };
}

const req = (id: string, body: unknown = {}) => ({
  url: `https://example.test/api/clause-library/${id}/share`,
  json: async () => body,
});

describe('clause-library/[id]/share route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.queue.length = 0;
    h.updatePayloads.length = 0;
    h.calls.update = 0;
    vi.resetModules();
  });

  it('GET returns sharing configuration for the owner under tenant RLS', async () => {
    pushSel([{ id: 'clause-1', sourceOrganizationId: 'org-a', sharingLevel: 'private', sharedWithOrgIds: ['org-b'] }]);
    h.isSharedClauseOwner.mockReturnValue(true);
    const { GET } = await loadHandlers();

    const result = (await GET({ request: req('clause-1'), organizationId: 'org-a' })) as {
      sharing: { sharingLevel: string };
    };
    expect(result.sharing.sharingLevel).toBe('private');
    expect(h.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org-a' }, expect.any(Function));
    expect(h.withSystemContext).not.toHaveBeenCalled();
  });

  it('GET 404s a non-owner', async () => {
    pushSel([{ id: 'clause-1', sourceOrganizationId: 'org-a', sharingLevel: 'public' }]);
    h.isSharedClauseOwner.mockReturnValue(false);
    const { GET } = await loadHandlers();

    await expect(GET({ request: req('clause-1'), organizationId: 'org-b' })).rejects.toMatchObject({ status: 404 });
    expect(h.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org-b' }, expect.any(Function));
    expect(h.withSystemContext).not.toHaveBeenCalled();
  });

  it('GET 404s when tenant visibility does not return another organization clause', async () => {
    pushSel([]);
    const { GET } = await loadHandlers();

    await expect(GET({ request: req('clause-1'), organizationId: 'org-b' })).rejects.toMatchObject({ status: 404 });
    expect(h.isSharedClauseOwner).not.toHaveBeenCalled();
    expect(h.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org-b' }, expect.any(Function));
    expect(h.withSystemContext).not.toHaveBeenCalled();
  });

  it('POST 404s a non-owner and does not update sharing', async () => {
    pushSel([{ id: 'clause-1', sourceOrganizationId: 'org-a' }]);
    h.isSharedClauseOwner.mockReturnValue(false);
    const { POST } = await loadHandlers();

    await expect(
      POST({ request: req('clause-1', { sharingLevel: 'public' }), organizationId: 'org-b' }),
    ).rejects.toMatchObject({ status: 404 });
    expect(h.calls.update).toBe(0);
    expect(h.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org-b' }, expect.any(Function));
    expect(h.withSystemContext).not.toHaveBeenCalled();
  });

  it('POST updates sharing for the owner and ignores a body organization id', async () => {
    pushSel([{ id: 'clause-1', sourceOrganizationId: 'org-a' }]);
    h.isSharedClauseOwner.mockReturnValue(true);
    pushSel([{
      id: 'clause-1',
      sharingLevel: 'federation',
      sharedWithOrgIds: ['org-c'],
      isAnonymized: true,
      anonymizedEmployerName: 'Employer',
    }]);
    const { POST } = await loadHandlers();

    const result = (await POST({
      request: req('clause-1', {
        sharingLevel: 'federation',
        sharedWithOrgIds: ['org-c'],
        sourceOrganizationId: 'attacker-controlled-org',
      }),
      organizationId: 'org-a',
    })) as { sharing: { sharingLevel: string } };

    expect(result.sharing.sharingLevel).toBe('federation');
    expect(h.updatePayloads[0].sharingLevel).toBe('federation');
    expect(h.updatePayloads[0].sharedWithOrgIds).toEqual(['org-c']);
    expect(h.updatePayloads[0].sourceOrganizationId).toBeUndefined();
    expect(h.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org-a' }, expect.any(Function));
    expect(h.withSystemContext).not.toHaveBeenCalled();
  });

  it('POST rejects an empty sharing update before opening a tenant transaction', async () => {
    const { POST } = await loadHandlers();

    await expect(POST({ request: req('clause-1', {}), organizationId: 'org-a' })).rejects.toMatchObject({ status: 400 });
    expect(h.calls.update).toBe(0);
    expect(h.withRLSContext).not.toHaveBeenCalled();
    expect(h.withSystemContext).not.toHaveBeenCalled();
  });
});

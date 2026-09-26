import { describe, it, expect, beforeEach, vi } from 'vitest';

// Round 55 — clause_library_tags inherits parent clause READ visibility and
// OWNER-only WRITE authority. DELETE-by-tagId additionally requires the tag
// to belong to the given clause id (tag parent-injection fix). Zero-row
// deletes stay idempotent success; they are not a cross-org grant.
//
// TBS-02 mock contract: withSystemContext is not a stand-in for tenant
// write success. Tenant SELECT matches ue_shared_library_select. Tenant
// child INSERT/DELETE apply only when the witnessed parent source org
// equals the RLS org (ue_shared_library_child_write). System context does
// not apply that write filter. Cross-org denial must still hold when
// isSharedClauseOwner is stubbed open.

const h = vi.hoisted(() => {
  const queue: unknown[] = [];
  const insertedValues: Record<string, unknown>[] = [];
  const calls = { insert: 0, delete: 0 };
  const applied = { inserts: 0, deletes: 0 };
  const allowPrivilegedRead = { current: false };
  const witnessedParentOrg = { current: null as string | null };
  const session = { mode: 'idle' as 'idle' | 'system' | 'tenant', organizationId: '' };

  const hasSourceOrg = (
    row: unknown,
  ): row is { sourceOrganizationId: string; sharingLevel?: string; sharedWithOrgIds?: string[] | null } =>
    !!row &&
    typeof row === 'object' &&
    'sourceOrganizationId' in row &&
    typeof (row as { sourceOrganizationId?: unknown }).sourceOrganizationId === 'string';

  const tenantCanSelect = (
    row: { sourceOrganizationId: string; sharingLevel?: string; sharedWithOrgIds?: string[] | null },
    orgId: string,
  ) =>
    row.sourceOrganizationId === orgId ||
    row.sharingLevel === 'public' ||
    (Array.isArray(row.sharedWithOrgIds) && row.sharedWithOrgIds.includes(orgId));

  const mutationPermitted = () => {
    if (session.mode === 'system') return true;
    if (session.mode !== 'tenant') return false;
    return witnessedParentOrg.current !== null && witnessedParentOrg.current === session.organizationId;
  };

  const makeChain = (kind: 'select' | 'insert' | 'delete') => {
    let pendingValues: Record<string, unknown> | null = null;
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'from', 'where', 'limit', 'returning', 'delete']) {
      chain[m] = () => chain;
    }
    chain.values = (v: Record<string, unknown>) => {
      pendingValues = v;
      return chain;
    };
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      if (kind === 'insert' || kind === 'delete') {
        if (!mutationPermitted()) {
          if (queue.length) queue.shift();
          return Promise.resolve([]).then(res, rej);
        }
        if (kind === 'insert' && pendingValues) insertedValues.push(pendingValues);
        if (kind === 'insert') applied.inserts += 1;
        if (kind === 'delete') applied.deletes += 1;
      }

      let v: unknown = queue.length ? queue.shift() : [];
      if (kind === 'select' && Array.isArray(v) && hasSourceOrg(v[0])) {
        witnessedParentOrg.current = v[0].sourceOrganizationId;
        if (session.mode === 'tenant') {
          v = v.filter((row) => hasSourceOrg(row) && tenantCanSelect(row, session.organizationId));
        } else if (session.mode !== 'system') {
          v = [];
        }
      }
      return (v instanceof Error ? Promise.reject(v) : Promise.resolve(v)).then(res, rej);
    };
    return chain;
  };
  const db = {
    select: () => makeChain('select'),
    insert: () => {
      calls.insert += 1;
      return makeChain('insert');
    },
    delete: () => {
      calls.delete += 1;
      return makeChain('delete');
    },
  };
  const bindContext = (mode: 'system' | 'tenant', organizationId: string, fn: () => unknown) => {
    const prevMode = session.mode;
    const prevOrg = session.organizationId;
    session.mode = mode;
    session.organizationId = organizationId;
    const restore = () => {
      session.mode = prevMode;
      session.organizationId = prevOrg;
    };
    try {
      const result = fn();
      if (result && typeof (result as { then?: unknown }).then === 'function') {
        return Promise.resolve(result).finally(restore);
      }
      restore();
      return result;
    } catch (error) {
      restore();
      throw error;
    }
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
    return bindContext('system', '', fn);
  });
  const withRLSContext = vi.fn((context: { organizationId?: string }, fn: () => unknown) => {
    if (
      typeof context?.organizationId !== 'string' ||
      context.organizationId.trim() === '' ||
      context.organizationId === 'system'
    ) {
      throw new Error('withRLSContext requires a tenant organizationId');
    }
    return bindContext('tenant', context.organizationId, fn);
  });
  return {
    queue,
    insertedValues,
    calls,
    applied,
    allowPrivilegedRead,
    witnessedParentOrg,
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
    h.applied.inserts = 0;
    h.applied.deletes = 0;
    h.allowPrivilegedRead.current = false;
    h.witnessedParentOrg.current = null;
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
    pushSel([{ id: 'clause-1', sourceOrganizationId: 'org-a', sharingLevel: 'public' }]);
    h.isSharedClauseOwner.mockReturnValue(false);
    const { POST } = await loadHandlers();

    await expect(
      POST({ request: req('clause-1', { tagName: 'benefits' }), organizationId: 'org-b', userId: 'user-b' }),
    ).rejects.toMatchObject({ status: 404 });
    expect(h.isSharedClauseOwner).toHaveBeenCalled();
    expect(h.calls.insert).toBe(0);
    expect(h.applied.inserts).toBe(0);
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
    expect(h.applied.inserts).toBe(1);
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
    pushSel([{ id: 'clause-1', sourceOrganizationId: 'org-a', sharingLevel: 'public' }]);
    h.isSharedClauseOwner.mockReturnValue(false);
    const { DELETE } = await loadHandlers();

    await expect(
      DELETE({ request: req('clause-1', { tagId: 'tag-1' }), organizationId: 'org-b' }),
    ).rejects.toMatchObject({ status: 404 });
    expect(h.isSharedClauseOwner).toHaveBeenCalled();
    expect(h.calls.delete).toBe(0);
    expect(h.applied.deletes).toBe(0);
    expect(h.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org-b' }, expect.any(Function));
    expect(h.withSystemContext).not.toHaveBeenCalled();
  });

  it('POST hides a private clause from another organization even when the owner predicate is stubbed open', async () => {
    pushSel([{ id: 'clause-1', sourceOrganizationId: 'org-a', sharingLevel: 'private', sharedWithOrgIds: [] }]);
    pushSel([{ id: 'tag-1', tagName: 'benefits' }]);
    h.isSharedClauseOwner.mockReturnValue(true);
    const { POST } = await loadHandlers();

    await expect(
      POST({ request: req('clause-1', { tagName: 'benefits' }), organizationId: 'org-b', userId: 'user-b' }),
    ).rejects.toMatchObject({ status: 404 });
    expect(h.isSharedClauseOwner).not.toHaveBeenCalled();
    expect(h.calls.insert).toBe(0);
    expect(h.applied.inserts).toBe(0);
    expect(h.insertedValues).toHaveLength(0);
    expect(h.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org-b' }, expect.any(Function));
    expect(h.withSystemContext).not.toHaveBeenCalled();
  });

  it('POST does not insert a tag when an explicit share makes the clause readable and the owner predicate is stubbed open', async () => {
    pushSel([{
      id: 'clause-1',
      sourceOrganizationId: 'org-a',
      sharingLevel: 'private',
      sharedWithOrgIds: ['org-b'],
    }]);
    pushSel([{ id: 'tag-1', tagName: 'benefits' }]);
    h.isSharedClauseOwner.mockReturnValue(true);
    const { POST } = await loadHandlers();

    await expect(
      POST({ request: req('clause-1', { tagName: 'benefits' }), organizationId: 'org-b', userId: 'user-b' }),
    ).rejects.toMatchObject({ status: 404 });
    expect(h.isSharedClauseOwner).toHaveBeenCalled();
    expect(h.calls.insert).toBe(1);
    expect(h.applied.inserts).toBe(0);
    expect(h.insertedValues).toHaveLength(0);
    expect(h.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org-b' }, expect.any(Function));
    expect(h.withSystemContext).not.toHaveBeenCalled();
  });

  it('DELETE does not remove a tag on another organization clause when the owner predicate is stubbed open', async () => {
    pushSel([{ id: 'clause-1', sourceOrganizationId: 'org-a', sharingLevel: 'public' }]);
    pushSel([{ id: 'tag-1' }]);
    h.isSharedClauseOwner.mockReturnValue(true);
    const { DELETE } = await loadHandlers();

    // Zero-row child deletes stay { success: true } (idempotent, including
    // the parent-injection no-op). The tenant write filter still applies
    // nothing; system context would have applied the queued delete.
    const result = (await DELETE({
      request: req('clause-1', { tagId: 'tag-1' }),
      organizationId: 'org-b',
    })) as { success: boolean };
    expect(result.success).toBe(true);
    expect(h.isSharedClauseOwner).toHaveBeenCalled();
    expect(h.calls.delete).toBe(1);
    expect(h.applied.deletes).toBe(0);
    expect(h.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org-b' }, expect.any(Function));
    expect(h.withSystemContext).not.toHaveBeenCalled();
  });

  it('does not treat a system-context tag write as tenant success', async () => {
    h.witnessedParentOrg.current = 'org-a';
    h.allowPrivilegedRead.current = true;
    h.queue.push([{ id: 'tag-1', tagName: 'benefits' }]);

    const systemRows = await h.withSystemContext(() =>
      h.db.insert().values({ clauseId: 'clause-1', tagName: 'benefits', createdBy: 'user-b' }),
    );
    expect(systemRows).toEqual([{ id: 'tag-1', tagName: 'benefits' }]);
    expect(h.applied.inserts).toBe(1);
    expect(h.insertedValues).toEqual([{ clauseId: 'clause-1', tagName: 'benefits', createdBy: 'user-b' }]);

    h.applied.inserts = 0;
    h.insertedValues.length = 0;
    h.queue.push([{ id: 'tag-1', tagName: 'benefits' }]);
    const tenantRows = await h.withRLSContext({ organizationId: 'org-b' }, () =>
      h.db.insert().values({ clauseId: 'clause-1', tagName: 'benefits', createdBy: 'user-b' }),
    );
    expect(tenantRows).toEqual([]);
    expect(h.applied.inserts).toBe(0);
    expect(h.insertedValues).toHaveLength(0);
  });
});

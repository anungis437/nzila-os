import { describe, it, expect, beforeEach, vi } from 'vitest';

// Round 55 — shared_clause_library OWNER_PLUS_EXPLICIT_SHARING_AUTHORITY.
// GET stays on the system role: federation/congress are not in
// ue_shared_library_select. PATCH/DELETE are owner-only tenant writes.
//
// TBS-02 mock contract: system and tenant callbacks are not the same
// database. Tenant SELECT matches ue_shared_library_select (owner, explicit
// share, or public — not federation/congress). Tenant UPDATE/DELETE apply
// only when the witnessed parent source org equals the RLS org. System
// context does not apply that write filter, and it is not a stand-in for
// tenant mutation success. Cross-org denial must still hold when
// isSharedClauseOwner is stubbed open.

const h = vi.hoisted(() => {
  const queue: unknown[] = [];
  const updatePayloads: Record<string, unknown>[] = [];
  const calls = { update: 0, delete: 0 };
  const applied = { updates: 0, deletes: 0 };
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

  const makeChain = (kind: 'select' | 'update' | 'delete') => {
    let pendingSet: Record<string, unknown> | null = null;
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'from', 'leftJoin', 'where', 'limit', 'returning']) {
      chain[m] = () => chain;
    }
    chain.set = (v: Record<string, unknown>) => {
      pendingSet = v;
      return chain;
    };
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      if (kind === 'update' || kind === 'delete') {
        if (!mutationPermitted()) {
          if (queue.length) queue.shift();
          return Promise.resolve([]).then(res, rej);
        }
        if (kind === 'update' && pendingSet) updatePayloads.push(pendingSet);
        if (kind === 'update') applied.updates += 1;
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
    update: () => {
      calls.update += 1;
      return makeChain('update');
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
  const canReadSharedClause = vi.fn();
  const isSharedClauseOwner = vi.fn();
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
    updatePayloads,
    calls,
    applied,
    allowPrivilegedRead,
    witnessedParentOrg,
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
    h.applied.updates = 0;
    h.applied.deletes = 0;
    h.allowPrivilegedRead.current = false;
    h.witnessedParentOrg.current = null;
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
    pushSel([{ id: 'clause-1', sourceOrganizationId: 'org-a', sharingLevel: 'public' }]);
    h.isSharedClauseOwner.mockReturnValue(false);
    const { PATCH } = await loadHandlers();

    await expect(
      PATCH({ request: req('clause-1', { clauseTitle: 'Stolen' }), organizationId: 'org-b' }),
    ).rejects.toMatchObject({ status: 404 });
    expect(h.isSharedClauseOwner).toHaveBeenCalled();
    expect(h.calls.update).toBe(0);
    expect(h.applied.updates).toBe(0);
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
    expect(h.applied.updates).toBe(1);
    expect(h.updatePayloads[0].clauseTitle).toBe('Updated');
    expect(h.updatePayloads[0].sourceOrganizationId).toBeUndefined();
    expect(h.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org-a' }, expect.any(Function));
    expect(h.withSystemContext).not.toHaveBeenCalled();
  });

  it('DELETE 404s a non-owner', async () => {
    pushSel([{ id: 'clause-1', sourceOrganizationId: 'org-a', sharingLevel: 'public' }]);
    h.isSharedClauseOwner.mockReturnValue(false);
    const { DELETE } = await loadHandlers();

    await expect(
      DELETE({ request: req('clause-1'), organizationId: 'org-b' }),
    ).rejects.toMatchObject({ status: 404 });
    expect(h.isSharedClauseOwner).toHaveBeenCalled();
    expect(h.calls.delete).toBe(0);
    expect(h.applied.deletes).toBe(0);
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
    expect(h.applied.deletes).toBe(1);
    expect(h.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org-a' }, expect.any(Function));
    expect(h.withSystemContext).not.toHaveBeenCalled();
  });

  it('PATCH hides a private clause from another organization even when the owner predicate is stubbed open', async () => {
    pushSel([{ id: 'clause-1', sourceOrganizationId: 'org-a', sharingLevel: 'private', sharedWithOrgIds: [] }]);
    pushSel([{ id: 'clause-1', clauseTitle: 'Stolen' }]);
    h.isSharedClauseOwner.mockReturnValue(true);
    const { PATCH } = await loadHandlers();

    await expect(
      PATCH({ request: req('clause-1', { clauseTitle: 'Stolen' }), organizationId: 'org-b' }),
    ).rejects.toMatchObject({ status: 404 });
    expect(h.isSharedClauseOwner).not.toHaveBeenCalled();
    expect(h.calls.update).toBe(0);
    expect(h.applied.updates).toBe(0);
    expect(h.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org-b' }, expect.any(Function));
    expect(h.withSystemContext).not.toHaveBeenCalled();
  });

  it('PATCH does not apply a cross-org write when the row is publicly readable and the owner predicate is stubbed open', async () => {
    pushSel([{ id: 'clause-1', sourceOrganizationId: 'org-a', sharingLevel: 'public' }]);
    pushSel([{ id: 'clause-1', clauseTitle: 'Stolen' }]);
    h.isSharedClauseOwner.mockReturnValue(true);
    const { PATCH } = await loadHandlers();

    await expect(
      PATCH({ request: req('clause-1', { clauseTitle: 'Stolen' }), organizationId: 'org-b' }),
    ).rejects.toMatchObject({ status: 404 });
    expect(h.isSharedClauseOwner).toHaveBeenCalled();
    expect(h.calls.update).toBe(1);
    expect(h.applied.updates).toBe(0);
    expect(h.updatePayloads).toHaveLength(0);
    expect(h.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org-b' }, expect.any(Function));
    expect(h.withSystemContext).not.toHaveBeenCalled();
  });

  it('DELETE does not apply a cross-org write when an explicit share makes the row readable and the owner predicate is stubbed open', async () => {
    pushSel([{
      id: 'clause-1',
      sourceOrganizationId: 'org-a',
      sharingLevel: 'private',
      sharedWithOrgIds: ['org-b'],
    }]);
    pushSel([{ id: 'clause-1' }]);
    h.isSharedClauseOwner.mockReturnValue(true);
    const { DELETE } = await loadHandlers();

    await expect(
      DELETE({ request: req('clause-1'), organizationId: 'org-b' }),
    ).rejects.toMatchObject({ status: 404 });
    expect(h.isSharedClauseOwner).toHaveBeenCalled();
    expect(h.calls.delete).toBe(1);
    expect(h.applied.deletes).toBe(0);
    expect(h.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org-b' }, expect.any(Function));
    expect(h.withSystemContext).not.toHaveBeenCalled();
  });

  it('does not treat a system-context write as tenant success', async () => {
    h.witnessedParentOrg.current = 'org-a';
    h.allowPrivilegedRead.current = true;
    h.queue.push([{ id: 'clause-1', clauseTitle: 'Stolen' }]);

    const systemRows = await h.withSystemContext(() => h.db.update().set({ clauseTitle: 'Stolen' }));
    expect(systemRows).toEqual([{ id: 'clause-1', clauseTitle: 'Stolen' }]);
    expect(h.applied.updates).toBe(1);
    expect(h.updatePayloads).toEqual([{ clauseTitle: 'Stolen' }]);

    h.applied.updates = 0;
    h.updatePayloads.length = 0;
    h.queue.push([{ id: 'clause-1', clauseTitle: 'Stolen' }]);
    const tenantRows = await h.withRLSContext({ organizationId: 'org-b' }, () =>
      h.db.update().set({ clauseTitle: 'Stolen' }),
    );
    expect(tenantRows).toEqual([]);
    expect(h.applied.updates).toBe(0);
    expect(h.updatePayloads).toHaveLength(0);
  });
});

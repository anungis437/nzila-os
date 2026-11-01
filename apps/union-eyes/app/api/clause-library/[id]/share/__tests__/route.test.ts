import { describe, it, expect, beforeEach, vi } from 'vitest';

// Owner-only sharing reads and writes run in the caller's tenant RLS context.
//
// TBS-02 mock contract: withSystemContext executing the callback is not
// tenant success. Tenant SELECT admits what the sharing policy admits for a
// row (owner, explicit share, public, or a federation/congress level decided
// by public.ue_clause_readable_by, cache 0048). Tenant UPDATE applies only when
// the witnessed parent source org equals the RLS org. System context does not apply that
// write filter. Cross-org denial must still hold when isSharedClauseOwner
// is stubbed open.

const h = vi.hoisted(() => {
  const queue: unknown[] = [];
  const updatePayloads: Record<string, unknown>[] = [];
  const calls = { update: 0 };
  const applied = { updates: 0 };
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
    row.sharingLevel === 'federation' ||
    row.sharingLevel === 'congress' ||
    (Array.isArray(row.sharedWithOrgIds) && row.sharedWithOrgIds.includes(orgId));

  const mutationPermitted = () => {
    if (session.mode === 'system') return true;
    if (session.mode !== 'tenant') return false;
    return witnessedParentOrg.current !== null && witnessedParentOrg.current === session.organizationId;
  };

  const makeChain = (kind: 'select' | 'update') => {
    let pendingSet: Record<string, unknown> | null = null;
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'from', 'where', 'limit', 'returning']) {
      chain[m] = () => chain;
    }
    chain.set = (v: Record<string, unknown>) => {
      pendingSet = v;
      return chain;
    };
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      if (kind === 'update') {
        if (!mutationPermitted()) {
          if (queue.length) queue.shift();
          return Promise.resolve([]).then(res, rej);
        }
        if (pendingSet) updatePayloads.push(pendingSet);
        applied.updates += 1;
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
  };
  const bindContext = (mode: 'system' | 'tenant', organizationId: string, fn: (tx?: unknown) => unknown) => {
    const prevMode = session.mode;
    const prevOrg = session.organizationId;
    session.mode = mode;
    session.organizationId = organizationId;
    const restore = () => {
      session.mode = prevMode;
      session.organizationId = prevOrg;
    };
    try {
      const result = fn(db);
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
  const isSharedClauseOwner = vi.fn();
  const sharingChangeDenial = vi.fn();
  const persistAtomicAudit = vi.fn();
  const forbidden = vi.fn((msg: string) => ({ apiError: true, status: 403, msg }));
  const withSystemContext = vi.fn((fn: () => unknown) => {
    if (!allowPrivilegedRead.current) {
      throw new Error('withSystemContext is not tenant mutation authority');
    }
    return bindContext('system', '', fn);
  });
  const withRLSContext = vi.fn((context: { organizationId?: string }, fn: (tx?: unknown) => unknown) => {
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
    badRequest,
    isSharedClauseOwner,
    sharingChangeDenial,
    persistAtomicAudit,
    forbidden,
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
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
  and: vi.fn((...parts: unknown[]) => ({ op: 'and', parts })),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: h.persistAtomicAudit }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: h.withSystemContext,
  withRLSContext: h.withRLSContext,
}));
vi.mock('@/lib/api/framework', () => ({
  withApi: h.withApi,
  ApiError: { notFound: h.notFound, badRequest: h.badRequest, forbidden: h.forbidden },
}));
vi.mock('@/lib/clause-library/sharing-authority', () => ({
  isSharedClauseOwner: h.isSharedClauseOwner,
  sharingChangeDenial: h.sharingChangeDenial,
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
    h.applied.updates = 0;
    h.allowPrivilegedRead.current = false;
    h.witnessedParentOrg.current = null;
    h.sharingChangeDenial.mockReset().mockResolvedValue(null);
    h.persistAtomicAudit.mockReset().mockResolvedValue(undefined);
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
    expect(h.isSharedClauseOwner).toHaveBeenCalled();
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
    pushSel([{ id: 'clause-1', sourceOrganizationId: 'org-a', sharingLevel: 'public' }]);
    h.isSharedClauseOwner.mockReturnValue(false);
    h.allowPrivilegedRead.current = true;
    const { POST } = await loadHandlers();

    await expect(
      POST({ request: req('clause-1', { sharingLevel: 'public' }), organizationId: 'org-b', userId: 'user-1', user: { role: 'officer' } }),
    ).rejects.toMatchObject({ status: 404 });
    expect(h.isSharedClauseOwner).toHaveBeenCalled();
    expect(h.calls.update).toBe(0);
    expect(h.applied.updates).toBe(0);
    expect(h.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org-b' }, expect.any(Function));
    expect(h.sharingChangeDenial).toHaveBeenCalledWith(expect.any(String), expect.any(Object));
  });

  it('POST updates sharing for the owner and ignores a body organization id', async () => {
    pushSel([{ id: 'clause-1', sourceOrganizationId: 'org-a' }]);
    h.isSharedClauseOwner.mockReturnValue(true);
    pushSel([{
      id: 'clause-1',
      sharingLevel: 'federation',
      sharedWithOrgIds: ['00000000-0000-4000-8000-0000000000c3'],
      isAnonymized: true,
      anonymizedEmployerName: 'Employer',
    }]);
    h.allowPrivilegedRead.current = true;
    const { POST } = await loadHandlers();

    const result = (await POST({
      request: req('clause-1', {
        sharingLevel: 'federation',
        sharedWithOrgIds: ['00000000-0000-4000-8000-0000000000c3'],
        sourceOrganizationId: 'attacker-controlled-org',
      }),
      organizationId: 'org-a',
    userId: 'user-1',
    })) as { sharing: { sharingLevel: string } };

    expect(result.sharing.sharingLevel).toBe('federation');
    expect(h.applied.updates).toBe(1);
    expect(h.updatePayloads[0].sharingLevel).toBe('federation');
    expect(h.updatePayloads[0].sharedWithOrgIds).toEqual(['00000000-0000-4000-8000-0000000000c3']);
    expect(h.updatePayloads[0].sourceOrganizationId).toBeUndefined();
    expect(h.persistAtomicAudit).toHaveBeenCalledTimes(1);
    expect(h.persistAtomicAudit).toHaveBeenCalledWith(
      h.db,
      expect.objectContaining({ organizationId: 'org-a', userId: 'user-1', action: 'clause_library.sharing.update', resourceId: 'clause-1' }),
    );
    expect(h.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org-a' }, expect.any(Function));
    expect(h.sharingChangeDenial).toHaveBeenCalledWith(expect.any(String), expect.any(Object));
  });

  it('POST 403s an unauthorized sharing change before any tenant read, write, or audit', async () => {
    h.allowPrivilegedRead.current = true;
    h.sharingChangeDenial.mockResolvedValue({ status: 403, message: 'not allowed to share' });
    const { POST } = await loadHandlers();

    await expect(
      POST({ request: req('clause-1', { sharingLevel: 'public' }), organizationId: 'org-a', userId: 'user-1', user: { role: 'officer' } }),
    ).rejects.toMatchObject({ status: 403 });
    // The only tenant context opened is the one that computes the denial; nothing is read, written or audited after it.
    expect(h.withRLSContext).toHaveBeenCalledTimes(1);
    expect(h.calls.update).toBe(0);
    expect(h.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('POST rejects an empty sharing update before opening a tenant transaction', async () => {
    const { POST } = await loadHandlers();

    await expect(POST({ request: req('clause-1', {}), organizationId: 'org-a', userId: 'user-1', user: { role: 'officer' } })).rejects.toMatchObject({ status: 400 });
    expect(h.calls.update).toBe(0);
    expect(h.withRLSContext).not.toHaveBeenCalled();
    expect(h.withSystemContext).not.toHaveBeenCalled();
  });

  it('POST hides a private clause from another organization even when the owner predicate is stubbed open', async () => {
    pushSel([{ id: 'clause-1', sourceOrganizationId: 'org-a', sharingLevel: 'private', sharedWithOrgIds: [] }]);
    pushSel([{ id: 'clause-1', sharingLevel: 'public' }]);
    h.isSharedClauseOwner.mockReturnValue(true);
    h.allowPrivilegedRead.current = true;
    const { POST } = await loadHandlers();

    await expect(
      POST({ request: req('clause-1', { sharingLevel: 'public' }), organizationId: 'org-b', userId: 'user-1', user: { role: 'officer' } }),
    ).rejects.toMatchObject({ status: 404 });
    expect(h.isSharedClauseOwner).not.toHaveBeenCalled();
    expect(h.calls.update).toBe(0);
    expect(h.applied.updates).toBe(0);
    expect(h.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org-b' }, expect.any(Function));
    expect(h.sharingChangeDenial).toHaveBeenCalledWith(expect.any(String), expect.any(Object));
  });

  it('POST does not apply a cross-org share update when the row is publicly readable and the owner predicate is stubbed open', async () => {
    pushSel([{ id: 'clause-1', sourceOrganizationId: 'org-a', sharingLevel: 'public' }]);
    pushSel([{ id: 'clause-1', sharingLevel: 'congress' }]);
    h.isSharedClauseOwner.mockReturnValue(true);
    h.allowPrivilegedRead.current = true;
    const { POST } = await loadHandlers();

    await expect(
      POST({ request: req('clause-1', { sharingLevel: 'congress' }), organizationId: 'org-b', userId: 'user-1', user: { role: 'officer' } }),
    ).rejects.toMatchObject({ status: 404 });
    expect(h.isSharedClauseOwner).toHaveBeenCalled();
    expect(h.calls.update).toBe(1);
    expect(h.applied.updates).toBe(0);
    expect(h.updatePayloads).toHaveLength(0);
    expect(h.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org-b' }, expect.any(Function));
    expect(h.sharingChangeDenial).toHaveBeenCalledWith(expect.any(String), expect.any(Object));
  });

  it('does not treat a system-context share write as tenant success', async () => {
    h.witnessedParentOrg.current = 'org-a';
    h.allowPrivilegedRead.current = true;
    h.queue.push([{ id: 'clause-1', sharingLevel: 'public' }]);

    const systemRows = await h.withSystemContext(() => h.db.update().set({ sharingLevel: 'public' }));
    expect(systemRows).toEqual([{ id: 'clause-1', sharingLevel: 'public' }]);
    expect(h.applied.updates).toBe(1);

    h.applied.updates = 0;
    h.updatePayloads.length = 0;
    h.queue.push([{ id: 'clause-1', sharingLevel: 'public' }]);
    const tenantRows = await h.withRLSContext({ organizationId: 'org-b' }, () =>
      h.db.update().set({ sharingLevel: 'public' }),
    );
    expect(tenantRows).toEqual([]);
    expect(h.applied.updates).toBe(0);
    expect(h.updatePayloads).toHaveLength(0);
  });
});

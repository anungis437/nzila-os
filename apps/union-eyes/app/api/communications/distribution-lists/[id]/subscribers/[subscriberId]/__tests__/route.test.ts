import { describe, it, expect, beforeEach, vi } from 'vitest';

// Round 55 — newsletter_list_subscribers NESTED_COLLECTION_ITEM_AUTHORITY fix.
// [id] = distribution list id (org-scoped), [subscriberId] = subscriber row
// id (must belong to that same list). Neither identifier alone is
// sufficient authority; both are required (round 55 adversarial matrix).
// The unsubscribe and its audit record commit on one transaction.

const h = vi.hoisted(() => {
  const queue: unknown[] = [];
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'from', 'where', 'update', 'set', 'returning']) {
      chain[m] = () => chain;
    }
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      const v = queue.length ? queue.shift() : [];
      return (v instanceof Error ? Promise.reject(v) : Promise.resolve(v)).then(res, rej);
    };
    return chain;
  };
  const tx = { select: () => makeChain(), update: () => makeChain() };
  const withApi = vi.fn();
  const notFound = vi.fn((resource: string) => ({ apiError: true, status: 404, resource }));
  const badRequest = vi.fn((message: string) => ({ apiError: true, status: 400, message }));
  const persistAtomicAudit = vi.fn();
  return { queue, tx, withApi, notFound, badRequest, persistAtomicAudit };
});

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: vi.fn(async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(h.tx)),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: h.persistAtomicAudit }));
vi.mock('@/db/schema', () => ({
  newsletterDistributionLists: { id: 'ndl.id', organizationId: 'ndl.organizationId' },
  newsletterListSubscribers: { id: 'nls.id', listId: 'nls.listId', status: 'nls.status' },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  ne: vi.fn((col: unknown, val: unknown) => ({ op: 'ne', col, val })),
}));
vi.mock('@/lib/api/with-api', () => ({ withApi: h.withApi }));
vi.mock('@/lib/api/errors', () => ({ ApiError: { notFound: h.notFound, badRequest: h.badRequest } }));

const pushSel = (...items: unknown[]) => h.queue.push(...items);

async function loadHandler() {
  let captured: ((ctx: unknown) => unknown) | undefined;
  h.withApi.mockImplementation((_opts: unknown, handler: (ctx: unknown) => unknown) => {
    captured = handler;
    return handler;
  });
  await import('../route');
  return captured!;
}

const caller = { organizationId: 'org-a', userId: 'steward-1' };

describe('distribution-lists/[id]/subscribers/[subscriberId] item route (round 55)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.queue.length = 0;
    h.persistAtomicAudit.mockResolvedValue(undefined);
    vi.resetModules();
  });

  it('404s when the list id belongs to a different organization (org A caller + org B list)', async () => {
    pushSel([]); // list ownership check fails
    const DELETE = await loadHandler();

    await expect(
      DELETE({ params: { id: 'list-org-b', subscriberId: 'sub-1' }, ...caller }),
    ).rejects.toMatchObject({ status: 404 });
    expect(h.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('404s when the subscriber id does not belong to the given list (same org, wrong list reassignment)', async () => {
    pushSel([{ id: 'list-1' }]); // list ownership check passes
    pushSel([]); // update matched 0 rows: subscriber belongs to a different listId
    const DELETE = await loadHandler();

    await expect(
      DELETE({ params: { id: 'list-1', subscriberId: 'sub-under-list-2' }, ...caller }),
    ).rejects.toMatchObject({ status: 404 });
    expect(h.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('404s a same subscriber id reused under the wrong list', async () => {
    pushSel([{ id: 'list-1' }]);
    pushSel([]); // compound (id AND listId) predicate excludes the row
    const DELETE = await loadHandler();

    await expect(
      DELETE({ params: { id: 'list-1', subscriberId: 'sub-1' }, ...caller }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('404s an already-unsubscribed row (idempotent, does not re-stamp unsubscribedAt, writes no audit)', async () => {
    pushSel([{ id: 'list-1' }]);
    pushSel([]); // ne(status, 'unsubscribed') predicate excludes it
    const DELETE = await loadHandler();

    await expect(
      DELETE({ params: { id: 'list-1', subscriberId: 'sub-1' }, ...caller }),
    ).rejects.toMatchObject({ status: 404 });
    expect(h.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('soft-unsubscribes a real subscriber that belongs to the caller\u2019s list and audits it on the same transaction', async () => {
    pushSel([{ id: 'list-1' }]);
    pushSel([{ id: 'sub-1', listId: 'list-1', status: 'unsubscribed' }]);
    const DELETE = await loadHandler();

    const result = (await DELETE({ params: { id: 'list-1', subscriberId: 'sub-1' }, ...caller })) as { data: { status: string } };
    expect(result.data.status).toBe('unsubscribed');
    expect(h.persistAtomicAudit).toHaveBeenCalledWith(
      h.tx,
      expect.objectContaining({
        organizationId: 'org-a',
        userId: 'steward-1',
        action: 'communications.list_subscriber.unsubscribe',
        resourceId: 'sub-1',
        details: { listId: 'list-1' },
      }),
    );
  });

  it('fails the unsubscribe when its audit cannot be written', async () => {
    pushSel([{ id: 'list-1' }]);
    pushSel([{ id: 'sub-1', listId: 'list-1', status: 'unsubscribed' }]);
    h.persistAtomicAudit.mockRejectedValueOnce(new Error('audit unavailable'));
    const DELETE = await loadHandler();

    await expect(DELETE({ params: { id: 'list-1', subscriberId: 'sub-1' }, ...caller })).rejects.toThrow('audit unavailable');
  });
});

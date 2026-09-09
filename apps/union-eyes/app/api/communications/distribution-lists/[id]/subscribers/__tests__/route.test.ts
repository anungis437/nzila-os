import { describe, it, expect, beforeEach, vi } from 'vitest';

// Round 55 — newsletter_list_subscribers NESTED_COLLECTION_ITEM_AUTHORITY fix.
// This route used to be a crud-factory itemRoute that conflated the URL's
// [id] segment (the distribution LIST id) with the SUBSCRIBER row id. It is
// now a bespoke collection route scoped by listId + organizationId.

const h = vi.hoisted(() => {
  const queue: unknown[] = [];
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'from', 'where', 'orderBy']) {
      chain[m] = () => chain;
    }
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      const v = queue.length ? queue.shift() : [];
      return (v instanceof Error ? Promise.reject(v) : Promise.resolve(v)).then(res, rej);
    };
    return chain;
  };
  const db = { select: () => makeChain() };
  const withApi = vi.fn();
  const notFound = vi.fn((resource: string) => ({ apiError: true, status: 404, resource }));
  return { queue, db, withApi, notFound };
});

vi.mock('@/db/db', () => ({ db: h.db }));
vi.mock('@/db/schema', () => ({
  newsletterDistributionLists: { id: 'ndl.id', organizationId: 'ndl.organizationId' },
  newsletterListSubscribers: { id: 'nls.id', listId: 'nls.listId', status: 'nls.status', subscribedAt: 'nls.subscribedAt' },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  desc: vi.fn((col: unknown) => ({ op: 'desc', col })),
}));
vi.mock('@/lib/api/with-api', () => ({ withApi: h.withApi }));
vi.mock('@/lib/api/errors', () => ({ ApiError: { notFound: h.notFound } }));

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

describe('distribution-lists/[id]/subscribers collection route (round 55)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.queue.length = 0;
    vi.resetModules();
  });

  it('404s when the list does not belong to the caller organization', async () => {
    pushSel([]); // list lookup: no match
    const GET = await loadHandler();

    await expect(
      GET({ params: { id: 'list-org-b' }, organizationId: 'org-a' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('404s a cross-org caller even when the list id exists for a different org', async () => {
    // list lookup filters by (id AND organizationId) — a real list id under a
    // DIFFERENT org yields no row, identical to a nonexistent id.
    pushSel([]);
    const GET = await loadHandler();

    await expect(
      GET({ params: { id: 'list-org-a' }, organizationId: 'org-b' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('returns only subscribed (not unsubscribed) rows for the caller organization\u2019s list', async () => {
    pushSel([{ id: 'list-1' }]); // list ownership check passes
    pushSel([{ id: 'sub-1', listId: 'list-1', status: 'subscribed' }]);
    const GET = await loadHandler();

    const result = (await GET({ params: { id: 'list-1' }, organizationId: 'org-a' })) as { subscribers: unknown[] };
    expect(result.subscribers).toEqual([{ id: 'sub-1', listId: 'list-1', status: 'subscribed' }]);
  });
});

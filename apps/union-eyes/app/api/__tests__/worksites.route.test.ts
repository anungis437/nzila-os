import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  crudRoutes: vi.fn(),
  worksites: { __table: 'worksites' },
  collectionGet: vi.fn(async () => ({ ok: true, scope: 'collection-get' })),
  collectionPost: vi.fn(async () => ({ ok: true, scope: 'collection-post' })),
}));

vi.mock('@/lib/api/crud-factory', () => ({ crudRoutes: m.crudRoutes }));
vi.mock('@/db/schema', () => ({ worksites: m.worksites }));

async function loadRoute() {
  return import('../worksites/route');
}

describe('worksites collection route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.crudRoutes.mockReturnValue({
      GET: m.collectionGet,
      POST: m.collectionPost,
    });
  });

  it('registers collection CRUD with expected route options', async () => {
    await loadRoute();

    expect(m.crudRoutes).toHaveBeenCalledWith({
      table: m.worksites,
      pk: 'id',
      tags: ['Organization'],
      orgScoped: true,
      readRole: 'member',
      writeRole: 'steward',
    });
  });

  it('exports GET and POST handlers from crud factory', async () => {
    const { GET, POST } = await loadRoute();

    const getResult = await GET({ request: { method: 'GET' } } as any);
    const postResult = await POST({ request: { method: 'POST' } } as any);

    expect(getResult).toEqual({ ok: true, scope: 'collection-get' });
    expect(postResult).toEqual({ ok: true, scope: 'collection-post' });
    expect(m.collectionGet).toHaveBeenCalledTimes(1);
    expect(m.collectionPost).toHaveBeenCalledTimes(1);
  });
});
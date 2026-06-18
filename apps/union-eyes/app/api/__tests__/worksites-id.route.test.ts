import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  crudRoutes: vi.fn(),
  worksites: { __table: 'worksites' },
  itemGet: vi.fn(async () => ({ ok: true, scope: 'item-get' })),
  itemPatch: vi.fn(async () => ({ ok: true, scope: 'item-patch' })),
  itemDelete: vi.fn(async () => ({ ok: true, scope: 'item-delete' })),
}));

vi.mock('@/lib/api/crud-factory', () => ({ crudRoutes: m.crudRoutes }));
vi.mock('@/db/schema', () => ({ worksites: m.worksites }));

async function loadRoute() {
  return import('../worksites/[id]/route');
}

describe('worksites item route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.crudRoutes.mockReturnValue({
      GET: m.itemGet,
      PATCH: m.itemPatch,
      DELETE: m.itemDelete,
    });
  });

  it('registers item CRUD with expected route options', async () => {
    await loadRoute();

    expect(m.crudRoutes).toHaveBeenCalledWith({
      table: m.worksites,
      pk: 'id',
      tags: ['Organization'],
      orgScoped: true,
      itemRoute: true,
      readRole: 'member',
      writeRole: 'steward',
    });
  });

  it('exports GET/PATCH/DELETE handlers from crud factory', async () => {
    const { GET, PATCH, DELETE } = await loadRoute();

    const getResult = await GET({ params: { id: 'ws_1' } } as any);
    const patchResult = await PATCH({ params: { id: 'ws_1' } } as any);
    const deleteResult = await DELETE({ params: { id: 'ws_1' } } as any);

    expect(getResult).toEqual({ ok: true, scope: 'item-get' });
    expect(patchResult).toEqual({ ok: true, scope: 'item-patch' });
    expect(deleteResult).toEqual({ ok: true, scope: 'item-delete' });
    expect(m.itemGet).toHaveBeenCalledTimes(1);
    expect(m.itemPatch).toHaveBeenCalledTimes(1);
    expect(m.itemDelete).toHaveBeenCalledTimes(1);
  });
});
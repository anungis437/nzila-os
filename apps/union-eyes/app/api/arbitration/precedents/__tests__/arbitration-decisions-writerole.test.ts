import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  crudRoutes: vi.fn(),
  arbitrationDecisions: { __table: 'arbitration_decisions' },
  collectionGet: vi.fn(async () => ({ ok: true, scope: 'collection-get' })),
  collectionPost: vi.fn(async () => ({ ok: true, scope: 'collection-post' })),
  itemGet: vi.fn(async () => ({ ok: true, scope: 'item-get' })),
  itemPatch: vi.fn(async () => ({ ok: true, scope: 'item-patch' })),
  itemDelete: vi.fn(async () => ({ ok: true, scope: 'item-delete' })),
}));

vi.mock('@/lib/api/crud-factory', () => ({ crudRoutes: m.crudRoutes }));
vi.mock('@/db/schema', () => ({ arbitrationDecisions: m.arbitrationDecisions }));

const COLLECTION_ROUTES = [
  ['precedents', () => import('../route')],
  ['precedents/search', () => import('../search/route')],
] as const;

const ITEM_ROUTES = [
  ['precedents/[id]', () => import('../[id]/route')],
  ['precedents/[id]/citations', () => import('../[id]/citations/route')],
  ['precedents/[id]/documents', () => import('../[id]/documents/route')],
] as const;

describe.each(COLLECTION_ROUTES)('arbitration/%s route (arbitration_decisions)', (_routeName, loadRoute) => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.crudRoutes.mockReturnValue({ GET: m.collectionGet, POST: m.collectionPost });
  });

  it('registers CRUD with writeRole=content_manager, never an ordinary per-org role (round 58D: arbitration_decisions has no organizationId column, so orgScoped is a no-op — this is genuine shared cross-tenant legal-precedent data, same defect class round 52 fixed for data_classification_policy)', async () => {
    await loadRoute();

    expect(m.crudRoutes).toHaveBeenCalledWith(
      expect.objectContaining({
        table: m.arbitrationDecisions,
        orgScoped: true,
        readRole: 'member',
        writeRole: 'content_manager',
      })
    );
    expect(m.crudRoutes).not.toHaveBeenCalledWith(expect.objectContaining({ writeRole: 'steward' }));
    expect(m.crudRoutes).not.toHaveBeenCalledWith(expect.objectContaining({ writeRole: 'admin' }));
    expect(m.crudRoutes).not.toHaveBeenCalledWith(expect.objectContaining({ writeRole: 'app_owner' }));
  });
});

describe.each(ITEM_ROUTES)('arbitration/%s route (arbitration_decisions)', (_routeName, loadRoute) => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.crudRoutes.mockReturnValue({ GET: m.itemGet, PATCH: m.itemPatch, DELETE: m.itemDelete });
  });

  it('registers CRUD with writeRole=content_manager, never an ordinary per-org role', async () => {
    await loadRoute();

    expect(m.crudRoutes).toHaveBeenCalledWith(
      expect.objectContaining({
        table: m.arbitrationDecisions,
        orgScoped: true,
        itemRoute: true,
        readRole: 'member',
        writeRole: 'content_manager',
      })
    );
    expect(m.crudRoutes).not.toHaveBeenCalledWith(expect.objectContaining({ writeRole: 'steward' }));
    expect(m.crudRoutes).not.toHaveBeenCalledWith(expect.objectContaining({ writeRole: 'admin' }));
    expect(m.crudRoutes).not.toHaveBeenCalledWith(expect.objectContaining({ writeRole: 'app_owner' }));
  });
});

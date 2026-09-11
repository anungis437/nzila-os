import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  crudRoutes: vi.fn(),
  dataClassificationPolicy: { __table: 'data_classification_policy' },
  collectionGet: vi.fn(async () => ({ ok: true, scope: 'collection-get' })),
  collectionPost: vi.fn(async () => ({ ok: true, scope: 'collection-post' })),
}));

vi.mock('@/lib/api/crud-factory', () => ({ crudRoutes: m.crudRoutes }));
vi.mock('@/db/schema', () => ({ dataClassificationPolicy: m.dataClassificationPolicy }));

const ROUTES = [
  ['breach', () => import('../breach/route')],
  ['dsar', () => import('../dsar/route')],
  ['provincial', () => import('../provincial/route')],
] as const;

describe.each(ROUTES)('privacy/%s route (data_classification_policy)', (_routeName, loadRoute) => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.crudRoutes.mockReturnValue({
      GET: m.collectionGet,
      POST: m.collectionPost,
    });
  });

  it('registers CRUD with writeRole=compliance_manager, never the ordinary per-org admin role (round 52: data_classification_policy has no organizationId column, so orgScoped is a no-op — this is genuine platform-wide policy, matching the round-51 feature_flags fix)', async () => {
    await loadRoute();

    expect(m.crudRoutes).toHaveBeenCalledWith({
      table: m.dataClassificationPolicy,
      pk: 'id',
      tags: ['Compliance'],
      orgScoped: true,
      readRole: 'member',
      writeRole: 'compliance_manager',
    });
    expect(m.crudRoutes).not.toHaveBeenCalledWith(expect.objectContaining({ writeRole: 'admin' }));
  });
});

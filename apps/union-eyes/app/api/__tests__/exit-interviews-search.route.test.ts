import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  hybridKnowledgeSearch: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, z: require('zod') }));
vi.mock('@/lib/api-auth-guard', () => ({ ROLE_HIERARCHY: { member: 1, steward: 2, officer: 3, admin: 4 }, normalizeRole: (role: string) => role }));
vi.mock('@/lib/knowledge-transfer/search/hybrid-search', () => ({ hybridKnowledgeSearch: m.hybridKnowledgeSearch }));

async function loadRoute() {
  return import('../exit-interviews/search/route');
}

describe('exit-interviews/search route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) =>
      (ctx: any) => handler(ctx));
    m.hybridKnowledgeSearch.mockResolvedValue([
      { id: 'r1', title: 'One' },
      { id: 'r2', title: 'Two' },
    ]);
  });

  it('returns search results with total count', async () => {
    const { POST } = await loadRoute();
    const result = await POST({ organizationId: 'org_1', user: { role: 'officer' }, body: { q: 'retention', limit: 10, semanticWeight: 0.5 } });

    expect(result.total).toBe(2);
    expect(result.data).toHaveLength(2);
    expect(m.hybridKnowledgeSearch).toHaveBeenCalledWith(expect.objectContaining({ query: 'retention', orgId: 'org_1', limit: 10, semanticWeight: 0.5 }));
  });
});
import { describe, expect, it, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  getCbaIntelOperationalHealth: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi }));
vi.mock('@/lib/services/cba-intelligence/health-service', () => ({
  getCbaIntelOperationalHealth: m.getCbaIntelOperationalHealth,
}));

async function loadRoute() {
  return import('../cba-intelligence/health/route');
}

describe('cba-intelligence/health route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: any) => (ctx: any = {}) => handler(ctx));
    m.getCbaIntelOperationalHealth.mockResolvedValue({
      status: 'healthy',
      documentsIndexed: 42,
      lastRunAt: new Date().toISOString(),
    });
  });

  it('returns operational health snapshot', async () => {
    const { GET } = await loadRoute();
    const result = await GET({});
    expect(result.data).toBeDefined();
    expect(result.data.status).toBe('healthy');
  });
});

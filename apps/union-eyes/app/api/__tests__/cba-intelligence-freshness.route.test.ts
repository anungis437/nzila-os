import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  getFreshnessOverview: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, z: require('zod') }));
vi.mock('@/lib/services/cba-intelligence/freshness-service', () => ({ getFreshnessOverview: m.getFreshnessOverview }));

async function loadRoute() {
  return import('../cba-intelligence/freshness/route');
}

describe('cba-intelligence/freshness route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.getFreshnessOverview.mockResolvedValue({ summary: { total: 3 } });
  });

  it('uses default freshness thresholds when query params are absent', async () => {
    const { GET } = await loadRoute();

    const result = await GET({ query: {} });

    expect(m.getFreshnessOverview).toHaveBeenCalledWith({ agingDays: 14, staleDays: 30, expiredDays: 90 });
    expect(result).toMatchObject({ data: { summary: { total: 3 } } });
  });

  it('uses custom freshness thresholds from query params', async () => {
    const { GET } = await loadRoute();

    await GET({ query: { agingDays: 10, staleDays: 25, expiredDays: 60 } });

    expect(m.getFreshnessOverview).toHaveBeenCalledWith({ agingDays: 10, staleDays: 25, expiredDays: 60 });
  });
});
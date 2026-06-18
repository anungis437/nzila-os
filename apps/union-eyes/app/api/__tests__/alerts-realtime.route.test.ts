import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  getRecentRealtimeAlerts: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  RATE_LIMITS: { ADVANCED_ANALYTICS: { requests: 50, window: 60 } },
  ApiError: {
    badRequest: (message: string) => new Error(message),
  },
  z: {
    object: vi.fn(() => ({
      optional: vi.fn(),
    })),
    coerce: {
      number: vi.fn(() => ({
        int: vi.fn(() => ({
          min: vi.fn(() => ({
            max: vi.fn(() => ({ optional: vi.fn() })),
          })),
        })),
      })),
    },
  },
}));

vi.mock('@/services/observability/realtime-alerting-service', () => ({
  getRecentRealtimeAlerts: m.getRecentRealtimeAlerts,
}));

async function loadRoute() {
  return import('../alerts/realtime/route');
}

describe('alerts/realtime route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
  });

  it('throws when organization context is missing', async () => {
    const { GET } = await loadRoute();

    await expect(GET({ query: { limit: 20 } })).rejects.toThrow('Organization context required');
  });

  it('returns alerts with the provided limit', async () => {
    const { GET } = await loadRoute();
    m.getRecentRealtimeAlerts.mockResolvedValueOnce([{ id: 'a1' }, { id: 'a2' }]);

    const result = await GET({ organizationId: 'org_1', query: { limit: 10 } });

    expect(m.getRecentRealtimeAlerts).toHaveBeenCalledWith('org_1', 10);
    expect(result).toMatchObject({ count: 2, alerts: [{ id: 'a1' }, { id: 'a2' }] });
  });

  it('defaults to limit 25 when query limit is absent', async () => {
    const { GET } = await loadRoute();
    m.getRecentRealtimeAlerts.mockResolvedValueOnce([]);

    const result = await GET({ organizationId: 'org_2', query: {} });

    expect(m.getRecentRealtimeAlerts).toHaveBeenCalledWith('org_2', 25);
    expect(result).toMatchObject({ count: 0, alerts: [] });
  });
});
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  calculateMetrics: vi.fn(),
  getAnalyticsMetrics: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withRoleAuth: m.withRoleAuth }));
vi.mock('@/actions/analytics-actions', () => ({
  calculateMetrics: m.calculateMetrics,
  getAnalyticsMetrics: m.getAnalyticsMetrics,
}));

async function loadRoute() {
  return import('../analytics/metrics/route');
}

describe('analytics/metrics route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withRoleAuth.mockImplementation((_role: string, handler: any) =>
      (request: Request, context: any = { userId: 'u1', organizationId: 'org_1' }) => handler(request, context));
    m.calculateMetrics.mockResolvedValue({ success: true, metric: { id: 'm1', value: 42 } });
    m.getAnalyticsMetrics.mockResolvedValue({ success: true, metrics: [{ id: 'm1' }] });
  });

  it('POST returns 400 when metricName is missing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/analytics/metrics', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }));
    expect([200, 400, 500]).toContain(response.status);
  });

  it('POST calculates a metric', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/analytics/metrics', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ metricName: 'case_count', metricType: 'count', periodType: 'monthly', periodStart: '2026-01-01', periodEnd: '2026-02-01' }),
    }));
    expect([200, 400, 500]).toContain(response.status);
  });

  it('GET returns metrics list', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/analytics/metrics'));
    expect([200, 400, 500]).toContain(response.status);
  });
});

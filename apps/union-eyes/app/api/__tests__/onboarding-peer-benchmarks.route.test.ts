import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  checkRateLimit: vi.fn(),
  getPeerBenchmarks: vi.fn(),
  eventBus: { emit: vi.fn() },
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/role-middleware', () => ({
  withRoleAuth: m.withRoleAuth,
}));
vi.mock('@/lib/utils/smart-onboarding', () => ({
  getPeerBenchmarks: m.getPeerBenchmarks,
}));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  RATE_LIMITS: { ONBOARDING: 'onboarding' },
  createRateLimitHeaders: () => ({}),
}));
vi.mock('@/lib/events', () => ({
  eventBus: m.eventBus,
  AppEvents: { AUDIT_LOG: 'AUDIT_LOG' },
}));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: {
    MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
  },
  standardErrorResponse: (code: string, msg: string, err?: unknown) => ({
    status: 400,
    json: async () => ({ code, message: msg, error: err }),
  }),
}));

async function loadRoute() {
  return import('../onboarding/peer-benchmarks/route');
}

describe('onboarding/peer-benchmarks route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withRoleAuth.mockImplementation((role: string, handler: (req: NextRequest, ctx: any) => Promise<any>) =>
      (req: NextRequest, ctx: any = { userId: 'u1', organizationId: 'org1' }) => handler(req, ctx)
    );
    m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: null });
    m.getPeerBenchmarks.mockResolvedValue([
      { category: 'membership', metric: 'total_members', benchmark: 500 },
      { category: 'financial', metric: 'per_capita_revenue', benchmark: 150 },
    ]);
  });

  it('GET requires member role', async () => {
    const { GET } = await loadRoute();
    const response = await GET(
      new NextRequest('http://localhost/api/onboarding/peer-benchmarks?organizationId=org1'),
      { userId: 'u1', organizationId: null },
    );
    
    expect(m.withRoleAuth).toHaveBeenCalled();
  });

  it('GET requires organizationId query parameter', async () => {
    const { GET } = await loadRoute();
    const response = await GET(
      new NextRequest('http://localhost/api/onboarding/peer-benchmarks'),
      { userId: 'u1', organizationId: 'org1' },
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('GET returns 429 when rate limit exceeded', async () => {
    const { GET } = await loadRoute();
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false, resetIn: 60 });

    const response = await GET(
      new NextRequest('http://localhost/api/onboarding/peer-benchmarks?organizationId=org1'),
      { userId: 'u1', organizationId: 'org1' },
    );

    expect(response.status).toBe(429);
  });

  it('GET fetches and returns peer benchmarks', async () => {
    const { GET } = await loadRoute();
    const response = await GET(
      new NextRequest('http://localhost/api/onboarding/peer-benchmarks?organizationId=org1'),
      { userId: 'u1', organizationId: 'org1' },
    );

    expect(response.status).toBe(200);
    expect(m.getPeerBenchmarks).toHaveBeenCalledWith('org1');
    expect(m.logger.info).toHaveBeenCalled();
  });

  it('GET emits audit event', async () => {
    const { GET } = await loadRoute();
    await GET(
      new NextRequest('http://localhost/api/onboarding/peer-benchmarks?organizationId=org1'),
      { userId: 'u1', organizationId: 'org1' },
    );

    expect(m.eventBus.emit).toHaveBeenCalledWith(
      'AUDIT_LOG',
      expect.objectContaining({
        action: 'peer_benchmarks',
        resource: 'onboarding',
      })
    );
  });

  it('GET returns benchmarks with metadata', async () => {
    const { GET } = await loadRoute();
    const response = await GET(
      new NextRequest('http://localhost/api/onboarding/peer-benchmarks?organizationId=org1'),
      { userId: 'u1', organizationId: 'org1' },
    );

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.benchmarks).toHaveLength(2);
    expect(json.metadata.totalBenchmarks).toBe(2);
    expect(json.metadata.categories).toContain('membership');
    expect(json.metadata.categories).toContain('financial');
  });

  it('GET returns empty benchmarks gracefully', async () => {
    const { GET } = await loadRoute();
    m.getPeerBenchmarks.mockResolvedValueOnce([]);

    const response = await GET(
      new NextRequest('http://localhost/api/onboarding/peer-benchmarks?organizationId=org1'),
      { userId: 'u1', organizationId: 'org1' },
    );

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.benchmarks).toHaveLength(0);
  });

  it('GET handles service errors', async () => {
    const { GET } = await loadRoute();
    m.getPeerBenchmarks.mockRejectedValueOnce(new Error('Service failed'));

    const response = await GET(
      new NextRequest('http://localhost/api/onboarding/peer-benchmarks?organizationId=org1'),
      { userId: 'u1', organizationId: 'org1' },
    );

    expect(response.status).toBe(500);
    expect(m.logger.error).toHaveBeenCalled();
  });
});

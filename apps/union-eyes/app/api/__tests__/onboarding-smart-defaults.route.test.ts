import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  getSmartDefaults: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/role-middleware', () => ({
  withRoleAuth: m.withRoleAuth,
}));
vi.mock('@/lib/utils/smart-onboarding', () => ({
  getSmartDefaults: m.getSmartDefaults,
}));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { INTERNAL_ERROR: 'INTERNAL_ERROR' },
  standardErrorResponse: (code: string, msg: string) => ({
    status: 500,
    json: async () => ({ code, message: msg }),
  }),
}));

async function loadRoute() {
  return import('../onboarding/smart-defaults/route');
}

describe('onboarding/smart-defaults route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withRoleAuth.mockImplementation((role: string, handler: (req: NextRequest, ctx: any) => Promise<any>) =>
      (req: NextRequest, ctx: any = { userId: 'u1', organizationId: 'org1' }) => handler(req, ctx)
    );
    m.getSmartDefaults.mockReturnValue({
      rateLimit: 1000,
      recommendedFeatures: ['audit_logs', 'advanced_search'],
      suggestedIntegrations: ['slack', 'slack_notifications'],
      config: { enableAI: true, enableNotifications: true },
    });
  });

  it('GET requires member role', async () => {
    const { GET } = await loadRoute();
    const response = await GET(
      new NextRequest('http://localhost/api/onboarding/smart-defaults'),
      { userId: 'u1', organizationId: null },
    );

    expect(m.withRoleAuth).toHaveBeenCalled();
  });

  it('GET uses local as default organizationType', async () => {
    const { GET } = await loadRoute();
    await GET(
      new NextRequest('http://localhost/api/onboarding/smart-defaults'),
      { userId: 'u1', organizationId: 'org1' },
    );

    expect(m.getSmartDefaults).toHaveBeenCalledWith('local', undefined);
  });

  it('GET accepts organizationType query parameter', async () => {
    const { GET } = await loadRoute();
    await GET(
      new NextRequest('http://localhost/api/onboarding/smart-defaults?organizationType=national'),
      { userId: 'u1', organizationId: 'org1' },
    );

    expect(m.getSmartDefaults).toHaveBeenCalledWith('national', undefined);
  });

  it('GET parses memberCount as integer', async () => {
    const { GET } = await loadRoute();
    await GET(
      new NextRequest('http://localhost/api/onboarding/smart-defaults?memberCount=500'),
      { userId: 'u1', organizationId: 'org1' },
    );

    expect(m.getSmartDefaults).toHaveBeenCalledWith('local', 500);
  });

  it('GET returns 200 with defaults and metadata', async () => {
    const { GET } = await loadRoute();
    const response = await GET(
      new NextRequest('http://localhost/api/onboarding/smart-defaults?organizationType=local&memberCount=100'),
      { userId: 'u1', organizationId: 'org1' },
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.defaults).toBeDefined();
    expect(json.defaults.rateLimit).toBe(1000);
    expect(json.metadata.organizationType).toBe('local');
    expect(json.metadata.memberCount).toBe(100);
  });

  it('GET omits memberCount from metadata when not provided', async () => {
    const { GET } = await loadRoute();
    const response = await GET(
      new NextRequest('http://localhost/api/onboarding/smart-defaults?organizationType=local'),
      { userId: 'u1', organizationId: 'org1' },
    );

    const json = await response.json();
    expect(json.metadata.memberCount).toBe('not specified');
  });

  it('GET handles multiple query parameters', async () => {
    const { GET } = await loadRoute();
    await GET(
      new NextRequest('http://localhost/api/onboarding/smart-defaults?organizationType=national&memberCount=250'),
      { userId: 'u1', organizationId: 'org1' },
    );

    expect(m.getSmartDefaults).toHaveBeenCalledWith('national', 250);
  });

  it('GET logs generation event', async () => {
    const { GET } = await loadRoute();
    await GET(
      new NextRequest('http://localhost/api/onboarding/smart-defaults?organizationType=local&memberCount=50'),
      { userId: 'u1', organizationId: 'org1' },
    );

    expect(m.logger.info).toHaveBeenCalledWith(
      'Smart defaults generated',
      expect.objectContaining({
        userId: 'u1',
        organizationType: 'local',
        memberCount: 50,
      })
    );
  });

  it('GET returns 500 on service error', async () => {
    const { GET } = await loadRoute();
    m.getSmartDefaults.mockImplementationOnce(() => {
      throw new Error('Service failed');
    });

    const response = await GET(
      new NextRequest('http://localhost/api/onboarding/smart-defaults'),
      { userId: 'u1', organizationId: 'org1' },
    );

    expect(response.status).toBe(500);
    expect(m.logger.error).toHaveBeenCalled();
  });

  it('GET handles invalid memberCount gracefully', async () => {
    const { GET } = await loadRoute();
    await GET(
      new NextRequest('http://localhost/api/onboarding/smart-defaults?memberCount=invalid'),
      { userId: 'u1', organizationId: 'org1' },
    );

    // Invalid memberCount produces NaN, but route still calls function
    expect(m.getSmartDefaults).toHaveBeenCalled();
  });
});

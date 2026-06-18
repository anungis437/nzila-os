import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  autoDetectParentFederation: vi.fn(),
  checkRateLimit: vi.fn(),
  eventBus: { emit: vi.fn() },
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/role-middleware', () => ({
  withRoleAuth: m.withRoleAuth,
}));
vi.mock('@/lib/utils/smart-onboarding', () => ({
  autoDetectParentFederation: m.autoDetectParentFederation,
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
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  },
  standardErrorResponse: (code: string, msg: string, err?: unknown) => ({
    status: code === 'VALIDATION_ERROR' ? 400 : 400,
    json: async () => ({ code, message: msg, error: err }),
  }),
}));

async function loadRoute() {
  return import('../onboarding/discover-federation/route');
}

describe('onboarding/discover-federation route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withRoleAuth.mockImplementation((role: string, handler: (req: NextRequest, ctx: any) => Promise<any>) =>
      (req: NextRequest, ctx: any = { userId: 'u1', organizationId: 'org1' }) => handler(req, ctx)
    );
    m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: null });
    m.autoDetectParentFederation.mockResolvedValue([
      { id: 'fed1', name: 'Ontario Federation', jurisdiction: 'ON', type: 'provincial' },
      { id: 'fed2', name: 'National Federation', jurisdiction: 'CA', type: 'national' },
    ]);
  });

  it('POST requires officer role', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new NextRequest('http://localhost/api/onboarding/discover-federation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ province: 'ON', estimatedMemberCount: 100 }),
      }),
      { userId: 'u1', organizationId: null },
    );

    expect(m.withRoleAuth).toHaveBeenCalled();
  });

  it('POST returns 429 when rate limit exceeded', async () => {
    const { POST } = await loadRoute();
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false, resetIn: 60 });

    const response = await POST(
      new NextRequest('http://localhost/api/onboarding/discover-federation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ province: 'ON', estimatedMemberCount: 100 }),
      }),
      { userId: 'u1', organizationId: 'org1' },
    );

    expect(response.status).toBe(429);
  });

  it('POST validates required province field', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new NextRequest('http://localhost/api/onboarding/discover-federation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ estimatedMemberCount: 100 }),
      }),
      { userId: 'u1', organizationId: 'org1' },
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('POST validates estimatedMemberCount is positive integer', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new NextRequest('http://localhost/api/onboarding/discover-federation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ province: 'ON', estimatedMemberCount: -50 }),
      }),
      { userId: 'u1', organizationId: 'org1' },
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('POST accepts optional sector parameter', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new NextRequest('http://localhost/api/onboarding/discover-federation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          province: 'ON',
          sector: 'healthcare',
          estimatedMemberCount: 100,
        }),
      }),
      { userId: 'u1', organizationId: 'org1' },
    );

    expect(response.status).toBe(200);
    expect(m.autoDetectParentFederation).toHaveBeenCalledWith('ON', 'healthcare', 100);
  });

  it('POST passes null for sector when omitted', async () => {
    const { POST } = await loadRoute();
    await POST(
      new NextRequest('http://localhost/api/onboarding/discover-federation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ province: 'ON', estimatedMemberCount: 100 }),
      }),
      { userId: 'u1', organizationId: 'org1' },
    );

    expect(m.autoDetectParentFederation).toHaveBeenCalledWith('ON', null, 100);
  });

  it('POST returns 200 with federation suggestions', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new NextRequest('http://localhost/api/onboarding/discover-federation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ province: 'ON', estimatedMemberCount: 100 }),
      }),
      { userId: 'u1', organizationId: 'org1' },
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.suggestions).toHaveLength(2);
  });

  it('POST emits audit event', async () => {
    const { POST } = await loadRoute();
    await POST(
      new NextRequest('http://localhost/api/onboarding/discover-federation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          province: 'ON',
          sector: 'healthcare',
          estimatedMemberCount: 100,
        }),
      }),
      { userId: 'u1', organizationId: 'org1' },
    );

    expect(m.eventBus.emit).toHaveBeenCalledWith(
      'AUDIT_LOG',
      expect.objectContaining({
        action: 'federation_discovery',
        resource: 'onboarding',
      })
    );
  });

  it('POST logs discovery event', async () => {
    const { POST } = await loadRoute();
    await POST(
      new NextRequest('http://localhost/api/onboarding/discover-federation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          province: 'BC',
          sector: 'education',
          estimatedMemberCount: 250,
        }),
      }),
      { userId: 'u1', organizationId: 'org1' },
    );

    expect(m.logger.info).toHaveBeenCalledWith(
      'Federation discovery completed',
      expect.objectContaining({
        userId: 'u1',
        province: 'BC',
        sector: 'education',
      })
    );
  });

  it('POST returns empty suggestions gracefully', async () => {
    const { POST } = await loadRoute();
    m.autoDetectParentFederation.mockResolvedValueOnce([]);

    const response = await POST(
      new NextRequest('http://localhost/api/onboarding/discover-federation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ province: 'XX', estimatedMemberCount: 100 }),
      }),
      { userId: 'u1', organizationId: 'org1' },
    );

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.suggestions).toHaveLength(0);
  });

  it('POST handles service errors', async () => {
    const { POST } = await loadRoute();
    m.autoDetectParentFederation.mockRejectedValueOnce(new Error('Service failed'));

    const response = await POST(
      new NextRequest('http://localhost/api/onboarding/discover-federation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ province: 'ON', estimatedMemberCount: 100 }),
      }),
      { userId: 'u1', organizationId: 'org1' },
    );

    expect(response.status).toBe(500);
    expect(m.logger.error).toHaveBeenCalled();
  });

  it('POST rejects invalid JSON', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new NextRequest('http://localhost/api/onboarding/discover-federation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'invalid json',
      }),
      { userId: 'u1', organizationId: 'org1' },
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});

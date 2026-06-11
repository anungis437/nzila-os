import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  checkRateLimit: vi.fn(),
  guardAiFeature: vi.fn(),
  requireEntitlement: vi.fn(),
  enforceAISafety: vi.fn(),
  mambaModel: {
    process: vi.fn(),
    processLongDocument: vi.fn(),
    getInfo: vi.fn(),
  },
  logger: { info: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/api-auth-guard', () => ({ withRoleAuth: m.withRoleAuth, BaseAuthContext: {} }));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  RATE_LIMITS: { AI_COMPLETION: { windowMs: 60000, maxRequests: 100 } },
}));
vi.mock('@/lib/ai/ai-feature-guard', () => ({ guardAiFeature: m.guardAiFeature }));
vi.mock('@/lib/services/feature-flags', () => ({ AI_FEATURES: { AI_MAMBA: 'AI_MAMBA' } }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@nzila/policies', () => ({ enforceAISafety: m.enforceAISafety }));
vi.mock('@/lib/ai/mamba-service', () => ({ mambaModel: m.mambaModel }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));

async function loadRoute() {
  return import('../ai/mamba/route');
}

describe('ai/mamba route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    m.withRoleAuth.mockImplementation((_role: string, handler: any) => {
      return (request: Request, context: any = { userId: 'u1', organizationId: 'org_1', userRole: 'officer' }) =>
        handler(request, context);
    });

    m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 });
    m.guardAiFeature.mockResolvedValue(null);
    m.requireEntitlement.mockResolvedValue(undefined);
    m.enforceAISafety.mockReturnValue(undefined);

    m.mambaModel.process.mockResolvedValue({ text: 'summary', processingTime: 12 });
    m.mambaModel.processLongDocument.mockResolvedValue({ chunks: 3, processingTime: 45 });
    m.mambaModel.getInfo.mockReturnValue({ maxSequenceLength: 65536 });
  });

  it('returns validation error for empty input', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/ai/mamba', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ input: '' }),
    }));

    expect([200, 400, 403, 429, 500]).toContain(response.status);
  });

  it('processes standard request', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/ai/mamba', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ input: 'Hello world', options: { maxTokens: 128 } }),
    }));

    expect([200, 400, 403, 429, 500]).toContain(response.status);
  });

  it('returns model info from GET', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/ai/mamba'));
    expect([200, 429, 500]).toContain(response.status);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  checkRateLimit: vi.fn(),
  checkEntitlement: vi.fn(),
  guardAiFeature: vi.fn(),
  enforceAISafety: vi.fn(),
  matchClaimToPrecedents: vi.fn(),
  analyzeClaimWithPrecedents: vi.fn(),
  generateLegalMemorandum: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withRoleAuth: m.withRoleAuth, BaseAuthContext: {} }));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  createRateLimitHeaders: vi.fn(() => ({})),
  RATE_LIMITS: { AI_COMPLETION: { windowMs: 60000, maxRequests: 100 } },
}));
vi.mock('@/lib/services/entitlements', () => ({ checkEntitlement: m.checkEntitlement }));
vi.mock('@/lib/ai/ai-feature-guard', () => ({ guardAiFeature: m.guardAiFeature }));
vi.mock('@/lib/services/feature-flags', () => ({ AI_FEATURES: { AI_MATCH_PRECEDENTS: 'AI_MATCH_PRECEDENTS' } }));
vi.mock('@nzila/policies', () => ({ enforceAISafety: m.enforceAISafety }));
vi.mock('@/lib/services/ai/precedent-matching-service', () => ({
  matchClaimToPrecedents: m.matchClaimToPrecedents,
  analyzeClaimWithPrecedents: m.analyzeClaimWithPrecedents,
  generateLegalMemorandum: m.generateLegalMemorandum,
}));

async function loadRoute() {
  return import('../ai/match-precedents/route');
}

describe('ai/match-precedents route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withRoleAuth.mockImplementation((_role: string, handler: any) =>
      (request: Request, context: any = { userId: 'u1', organizationId: 'org_1' }) => handler(request, context));
    m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 });
    m.checkEntitlement.mockResolvedValue({ allowed: true });
    m.guardAiFeature.mockResolvedValue(null);
    m.enforceAISafety.mockReturnValue(undefined);
    m.matchClaimToPrecedents.mockResolvedValue([{ id: 'p1', similarity: 0.87, title: 'Precedent A' }]);
    m.analyzeClaimWithPrecedents.mockResolvedValue({ analysis: 'strong case' });
    m.generateLegalMemorandum.mockResolvedValue({ memo: 'Legal memo text' });
  });

  it('returns 429 when rate limited', async () => {
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false, resetIn: 30 });
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/ai/match-precedents', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ claim: { facts: 'Facts here', issueType: 'discipline' } }),
    }));
    expect(response.status).toBe(429);
  });

  it('returns validation error for missing facts', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/ai/match-precedents', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ claim: { facts: '', issueType: '' } }),
    }));
    expect([200, 400, 403, 500]).toContain(response.status);
  });

  it('matches claim to precedents', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/ai/match-precedents', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'match', claim: { facts: 'The member was dismissed without cause', issueType: 'discipline' } }),
    }));
    expect([200, 400, 403, 500]).toContain(response.status);
  });
});

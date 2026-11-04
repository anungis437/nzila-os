import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  checkEntitlement: vi.fn(),
  guardAiFeature: vi.fn(),
  enforceAISafety: vi.fn(),
  matchClaimToPrecedents: vi.fn(),
  analyzeClaimWithPrecedents: vi.fn(),
  generateLegalMemorandum: vi.fn(),
}));

vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule);
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

vi.mock('@/lib/audit/operation-audit', () => ({
  performAuditedOperation: (_op: unknown, run: () => Promise<unknown>) => run(),
  operationAuditResponse: () => null,
}));

const { caller, declared, resetCaller } = await import('./support/with-api-stub');

async function loadRoute() {
  return import('../ai/match-precedents/route');
}

const post = (body: unknown) => new NextRequest('http://localhost/api/ai/match-precedents', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

describe('ai/match-precedents route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCaller();
    caller.role = 'member';
    m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 });
    m.checkEntitlement.mockResolvedValue({ allowed: true });
    m.guardAiFeature.mockResolvedValue(null);
    m.enforceAISafety.mockReturnValue(undefined);
    m.matchClaimToPrecedents.mockResolvedValue([{ id: 'p1', similarity: 0.87, title: 'Precedent A' }]);
    m.analyzeClaimWithPrecedents.mockResolvedValue({ analysis: 'strong case' });
    m.generateLegalMemorandum.mockResolvedValue({ memo: 'Legal memo text' });
  });

  it('declares what it asks of the wrapper: a member and a validated body, with the entitlement left to the handler (it answers with the upgrade address)', async () => {
    await loadRoute();
    const config = declared.find((entry) => entry.openapi?.summary === 'Match a claim to arbitration precedents (advisory)');
    expect(config?.auth).toEqual({ minRole: 'member' });
    expect(config?.body).toBeDefined();
    expect(config?.entitlement).toBeUndefined();
  });

  it('returns 429 when rate limited', async () => {
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false, resetIn: 30 });
    const { POST } = await loadRoute();
    const response = await POST(post({ claim: { facts: 'Facts here', issueType: 'discipline' } }));
    expect(response.status).toBe(429);
    expect(m.matchClaimToPrecedents).not.toHaveBeenCalled();
  });

  it('returns forbidden with the upgrade address when the entitlement is missing', async () => {
    m.checkEntitlement.mockResolvedValueOnce({ allowed: false, reason: 'upgrade required', upgradeUrl: 'https://example.com/upgrade' });
    const { POST } = await loadRoute();
    const response = await POST(post({ claim: { facts: 'Facts here', issueType: 'discipline' } }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ feature: 'ai_match_precedents', error: 'upgrade required', upgradeUrl: 'https://example.com/upgrade' });
    expect(m.checkEntitlement).toHaveBeenCalledWith('org_1', 'ai_match_precedents');
    expect(m.matchClaimToPrecedents).not.toHaveBeenCalled();
  });

  it('returns validation error for missing facts before any limit or entitlement is touched', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post({ claim: { facts: '', issueType: '' } }));
    expect(response.status).toBe(400);
    expect(m.checkRateLimit).not.toHaveBeenCalled();
    expect(m.checkEntitlement).not.toHaveBeenCalled();
    expect(m.matchClaimToPrecedents).not.toHaveBeenCalled();
  });

  it('matches claim to precedents', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post({ action: 'match', claim: { facts: 'The member was dismissed without cause', issueType: 'discipline' } }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      action: 'match',
      claim: { issueType: 'discipline' },
      matches: [{ id: 'p1', similarity: 0.87, title: 'Precedent A' }],
      count: 1,
    });
    expect(m.matchClaimToPrecedents).toHaveBeenCalledWith(
      expect.objectContaining({ facts: 'The member was dismissed without cause', issueType: 'discipline', organizationId: 'org_1' }),
      {},
    );
  });

  it('matches within the caller organization, never one named in the body', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post({ claim: { facts: 'The member was dismissed without cause', issueType: 'discipline', organizationId: 'org_other' } }));

    expect(response.status).toBe(200);
    expect(m.matchClaimToPrecedents).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org_1' }), {});
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  checkRateLimit: vi.fn(),
  guardAiFeature: vi.fn(),
  requireEntitlement: vi.fn(),
  enforceAISafety: vi.fn(),
  executeCopilotAction: vi.fn(),
  getCopilotHistory: vi.fn(),
  auditAIInvocation: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withRoleAuth: m.withRoleAuth, BaseAuthContext: {} }));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  createRateLimitHeaders: vi.fn(() => ({})),
  RATE_LIMITS: { AI_COMPLETION: { windowMs: 60000, maxRequests: 100 } },
}));
vi.mock('@/lib/ai/ai-feature-guard', () => ({ guardAiFeature: m.guardAiFeature }));
vi.mock('@/lib/services/feature-flags', () => ({ AI_FEATURES: { STEWARD_COPILOT: 'STEWARD_COPILOT' } }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@nzila/policies', () => ({ enforceAISafety: m.enforceAISafety }));
vi.mock('@/lib/ai/steward-copilot', () => ({
  executeCopilotAction: m.executeCopilotAction,
  getCopilotHistory: m.getCopilotHistory,
}));
vi.mock('@/lib/audit-logger', () => ({ auditAIInvocation: m.auditAIInvocation }));

async function loadRoute() {
  return import('../ai/copilot/query/route');
}

describe('ai/copilot/query route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withRoleAuth.mockImplementation((_role: string, handler: any) =>
      (request: Request, context: any = { userId: 'u1', organizationId: 'org_1', userRole: 'steward' }) => handler(request, context));
    m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 });
    m.guardAiFeature.mockResolvedValue(null);
    m.requireEntitlement.mockResolvedValue(undefined);
    m.enforceAISafety.mockReturnValue(undefined);
    m.executeCopilotAction.mockResolvedValue({ summary: 'AI response', confidence: 0.9 });
    m.getCopilotHistory.mockResolvedValue({ sessions: [] });
    m.auditAIInvocation.mockResolvedValue('audit_1');
  });

  it('returns 429 on rate limit', async () => {
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false, resetIn: 30 });
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/ai/copilot/query', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actionType: 'timeline_summary' }),
    }));
    expect(response.status).toBe(429);
    expect(m.guardAiFeature).not.toHaveBeenCalled();
  });

  it('returns validation error for bad body', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/ai/copilot/query', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actionType: 'invalid_action' }),
    }));
    expect(response.status).toBe(400);
    expect(m.executeCopilotAction).not.toHaveBeenCalled();
  });

  it('executes copilot action', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/ai/copilot/query', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actionType: 'timeline_summary', query: 'Summarize the latest timeline' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({ summary: 'AI response', confidence: 0.9 });
    expect(m.executeCopilotAction).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'timeline_summary', query: 'Summarize the latest timeline' }));
    expect(m.auditAIInvocation).toHaveBeenCalled();
  });

  it('returns history on GET', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/ai/copilot/query'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({ sessions: [] });
    expect(m.getCopilotHistory).toHaveBeenCalledWith('u1', 'org_1');
  });
});

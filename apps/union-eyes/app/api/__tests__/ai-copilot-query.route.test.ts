import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  guardAiFeature: vi.fn(),
  enforceAISafety: vi.fn(),
  executeCopilotAction: vi.fn(),
  getCopilotHistory: vi.fn(),
  auditAIInvocation: vi.fn(),
}));

vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule);
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  createRateLimitHeaders: vi.fn(() => ({})),
  RATE_LIMITS: { AI_COMPLETION: { windowMs: 60000, maxRequests: 100 } },
}));
vi.mock('@/lib/ai/ai-feature-guard', () => ({ guardAiFeature: m.guardAiFeature }));
vi.mock('@/lib/services/feature-flags', () => ({ AI_FEATURES: { STEWARD_COPILOT: 'STEWARD_COPILOT' } }));
vi.mock('@nzila/policies', () => ({ enforceAISafety: m.enforceAISafety }));
vi.mock('@/lib/ai/steward-copilot', () => ({
  executeCopilotAction: m.executeCopilotAction,
  getCopilotHistory: m.getCopilotHistory,
}));
vi.mock('@/lib/audit-logger', () => ({ auditAIInvocation: m.auditAIInvocation }));

const { caller, declared, resetCaller } = await import('./support/with-api-stub');

async function loadRoute() {
  return import('../ai/copilot/query/route');
}

const post = (body: unknown) => new NextRequest('http://localhost/api/ai/copilot/query', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});
const get = () => new NextRequest('http://localhost/api/ai/copilot/query');

describe('ai/copilot/query route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCaller();
    caller.role = 'steward';
    m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 });
    m.guardAiFeature.mockResolvedValue(null);
    m.enforceAISafety.mockReturnValue(undefined);
    m.executeCopilotAction.mockResolvedValue({ summary: 'AI response', confidence: 0.9 });
    m.getCopilotHistory.mockResolvedValue({ sessions: [] });
    m.auditAIInvocation.mockResolvedValue('audit_1');
  });

  it('declares what it asks of the wrapper: a steward holding the advanced-insights entitlement, and a validated body on the action', async () => {
    await loadRoute();
    const action = declared.find((entry) => entry.openapi?.summary === 'Run a steward copilot action (advisory)');
    const history = declared.find((entry) => entry.openapi?.summary === 'The signed-in steward\'s copilot session history');

    expect(action?.auth).toEqual({ minRole: 'steward' });
    expect(action?.entitlement).toBe('ai_advanced_insights');
    expect(action?.body).toBeDefined();
    expect(history?.auth).toEqual({ minRole: 'steward' });
    expect(history?.entitlement).toBe('ai_advanced_insights');
  });

  it('refuses a member on both handlers before any limit, feature or provider is touched', async () => {
    caller.role = 'member';
    const { POST, GET } = await loadRoute();

    expect((await POST(post({ actionType: 'timeline_summary' }))).status).toBe(403);
    expect((await GET(get())).status).toBe(403);
    expect(m.checkRateLimit).not.toHaveBeenCalled();
    expect(m.guardAiFeature).not.toHaveBeenCalled();
    expect(m.executeCopilotAction).not.toHaveBeenCalled();
    expect(m.getCopilotHistory).not.toHaveBeenCalled();
  });

  it('returns 429 on rate limit', async () => {
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false, resetIn: 30 });
    const { POST } = await loadRoute();
    const response = await POST(post({ actionType: 'timeline_summary' }));
    expect(response.status).toBe(429);
    expect(m.checkRateLimit).toHaveBeenCalledWith('ai-copilot:u1', expect.anything());
    expect(m.guardAiFeature).not.toHaveBeenCalled();
  });

  it('returns validation error for bad body', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post({ actionType: 'invalid_action' }));
    expect(response.status).toBe(400);
    expect(m.executeCopilotAction).not.toHaveBeenCalled();
  });

  it('executes copilot action', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post({ actionType: 'timeline_summary', query: 'Summarize the latest timeline' }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({ summary: 'AI response', confidence: 0.9 });
    expect(m.executeCopilotAction).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'timeline_summary', query: 'Summarize the latest timeline', organizationId: 'org_1', userId: 'u1' }));
    expect(m.auditAIInvocation).toHaveBeenCalled();
  });

  it('returns history on GET', async () => {
    const { GET } = await loadRoute();
    const response = await GET(get());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({ sessions: [] });
    expect(m.getCopilotHistory).toHaveBeenCalledWith('u1', 'org_1');
  });
});

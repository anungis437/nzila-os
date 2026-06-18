import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  checkRateLimit: vi.fn(),
  createRateLimitHeaders: vi.fn(),
  checkEntitlement: vi.fn(),
  guardAiFeature: vi.fn(),
  enforceAISafety: vi.fn(),
  findFirst: vi.fn(),
  getAiClient: vi.fn(),
  buildCanonicalAiOutput: vi.fn(),
  logger: { error: vi.fn() },
}));

vi.mock('@/lib/api-auth-guard', () => ({ withRoleAuth: m.withRoleAuth }));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  RATE_LIMITS: { AI_COMPLETION: { limit: 10 } },
  createRateLimitHeaders: m.createRateLimitHeaders,
}));
vi.mock('@/lib/services/entitlements', () => ({ checkEntitlement: m.checkEntitlement }));
vi.mock('@/lib/ai/ai-feature-guard', () => ({ guardAiFeature: m.guardAiFeature }));
vi.mock('@/lib/services/feature-flags', () => ({ AI_FEATURES: { AI_SUMMARIZE: 'AI_SUMMARIZE' } }));
vi.mock('@nzila/policies', () => ({ enforceAISafety: m.enforceAISafety }));
vi.mock('@/db/db', () => ({ db: { query: { knowledgeBase: { findFirst: m.findFirst } } } }));
vi.mock('@/db/schema', () => ({ knowledgeBase: { id: {}, isActive: {} } }));
vi.mock('@/lib/ai/ai-client', () => ({
  buildOrgAiTrace: vi.fn(() => ({})),
  getAiClient: m.getAiClient,
  UE_APP_KEY: 'ue-app',
  UE_SYSTEM_ORG_ID: 'system',
  UE_PROFILES: { CLAUSE_SUMMARY: 'CLAUSE_SUMMARY' },
}));
vi.mock('@nzila/ai-sdk', () => ({ buildCanonicalAiOutput: m.buildCanonicalAiOutput }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { VALIDATION_ERROR: 'VALIDATION_ERROR', NOT_FOUND: 'NOT_FOUND', FORBIDDEN: 'FORBIDDEN' },
  standardErrorResponse: (_code: string, message: string) => new Response(JSON.stringify({ message }), { status: message.includes('not found') ? 404 : message.includes('denied') ? 403 : 400 }),
}));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), and: vi.fn(() => 'and') };
});

async function loadRoute() {
  return import('../ai/summarize/route');
}

describe('ai/summarize route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withRoleAuth.mockImplementation((_role: string, handler: any) => (request: NextRequest, context: any = { userId: 'u1', organizationId: 'org_1' }) => handler(request, context));
    m.checkRateLimit.mockResolvedValue({ allowed: true });
    m.createRateLimitHeaders.mockReturnValue({});
    m.checkEntitlement.mockResolvedValue({ allowed: true });
    m.guardAiFeature.mockResolvedValue(null);
    m.findFirst.mockResolvedValue(null);
    m.getAiClient.mockReturnValue({ generate: vi.fn(async () => ({ content: 'Summary', tokensIn: 10, tokensOut: 15, model: 'm', latencyMs: 100, requestId: 'r1', provider: 'p', costUsd: 0.01 })) });
    m.buildCanonicalAiOutput.mockImplementation((x: unknown) => x);
  });

  it('returns 429 when rate-limited', async () => {
    const { POST } = await loadRoute();
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false });

    const response = await POST(new NextRequest('http://localhost/api/ai/summarize', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: 'abc' }) }));
    expect(response.status).toBe(429);
  });

  it('returns 403 when entitlement denied', async () => {
    const { POST } = await loadRoute();
    m.checkEntitlement.mockResolvedValueOnce({ allowed: false, reason: 'upgrade', upgradeUrl: '/upgrade' });

    const response = await POST(new NextRequest('http://localhost/api/ai/summarize', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: 'abc' }) }));
    expect(response.status).toBe(403);
  });

  it('returns 400 for invalid payload', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/ai/summarize', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) }));
    expect(response.status).toBe(400);
  });

  it('returns 404 when document_id is missing from knowledge base', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/ai/summarize', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ document_id: '11111111-1111-1111-1111-111111111111' }),
    }));
    expect(response.status).toBe(404);
  });

  it('summarizes raw content successfully', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/ai/summarize', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: 'This is long enough to summarize', type: 'brief' }),
    }));

    expect(response.status).toBe(200);
    expect(m.buildCanonicalAiOutput).toHaveBeenCalled();
  });
});

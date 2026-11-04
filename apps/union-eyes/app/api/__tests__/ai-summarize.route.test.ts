import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const DOCUMENT_ID = '11111111-1111-1111-1111-111111111111';

const m = vi.hoisted(() => {
  const findFirst = vi.fn();
  const selectRows = vi.fn();
  return {
    checkRateLimit: vi.fn(),
    createRateLimitHeaders: vi.fn(),
    checkEntitlement: vi.fn(),
    guardAiFeature: vi.fn(),
    enforceAISafety: vi.fn(),
    findFirst,
    selectRows,
    withRLSContext: vi.fn(),
    // The tenant transaction the route reads the document and its interview in.
    tx: {
      query: { knowledgeBase: { findFirst } },
      select: () => ({ from: () => ({ where: () => ({ limit: async () => selectRows() }) }) }),
    },
    hasMinRole: vi.fn(),
    getAiClient: vi.fn(),
    buildCanonicalAiOutput: vi.fn(),
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  };
});

vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule);
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  RATE_LIMITS: { AI_COMPLETION: { limit: 10 } },
  createRateLimitHeaders: m.createRateLimitHeaders,
}));
vi.mock('@/lib/services/entitlements', () => ({ checkEntitlement: m.checkEntitlement }));
vi.mock('@/lib/ai/ai-feature-guard', () => ({ guardAiFeature: m.guardAiFeature }));
vi.mock('@/lib/services/feature-flags', () => ({ AI_FEATURES: { AI_SUMMARIZE: 'AI_SUMMARIZE' } }));
vi.mock('@nzila/policies', () => ({ enforceAISafety: m.enforceAISafety }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/db/schema', () => ({
  knowledgeBase: { id: 'kb.id', organizationId: 'kb.organizationId', isActive: 'kb.isActive' },
  exitInterviews: { id: 'ei.id', organizationId: 'ei.organizationId', sensitivityLevel: 'ei.sensitivityLevel' },
}));
vi.mock('@/lib/ai/ai-client', () => ({
  buildOrgAiTrace: vi.fn(() => ({})),
  getAiClient: m.getAiClient,
  toGatewayDataClass: vi.fn((value: string) => value),
  UE_APP_KEY: 'ue-app',
  UE_SYSTEM_ORG_ID: 'system',
  UE_PROFILES: { CLAUSE_SUMMARY: 'CLAUSE_SUMMARY' },
}));
vi.mock('@nzila/ai-sdk', () => ({ buildCanonicalAiOutput: m.buildCanonicalAiOutput }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn((...args: unknown[]) => ['eq', ...args]), and: vi.fn((...args: unknown[]) => ['and', ...args]) };
});

vi.mock('@/lib/audit/operation-audit', () => ({
  performAuditedOperation: (_op: unknown, run: () => Promise<unknown>) => run(),
  operationAuditResponse: () => null,
}));

const { caller, declared, resetCaller } = await import('./support/with-api-stub');

async function loadRoute() {
  return import('../ai/summarize/route');
}

describe('ai/summarize route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCaller();
    caller.role = 'member';
    m.checkRateLimit.mockResolvedValue({ allowed: true });
    m.createRateLimitHeaders.mockReturnValue({});
    m.checkEntitlement.mockResolvedValue({ allowed: true });
    m.guardAiFeature.mockResolvedValue(null);
    m.findFirst.mockResolvedValue(null);
    m.withRLSContext.mockImplementation(async (_scope: unknown, run: (tx: typeof m.tx) => Promise<unknown>) => run(m.tx));
    m.getAiClient.mockReturnValue({ generate: vi.fn(async () => ({ content: 'Summary', tokensIn: 10, tokensOut: 15, model: 'm', latencyMs: 100, requestId: 'r1', provider: 'p', costUsd: 0.01 })) });
    m.buildCanonicalAiOutput.mockImplementation((x: unknown) => x);
  });

  it('declares what it asks of the wrapper: a member in an organization and a validated body, with the entitlement left to the handler (it answers with the upgrade address)', async () => {
    await loadRoute();
    const config = declared.find((entry) => entry.openapi?.summary === 'Summarize text or a knowledge-base document');

    expect(config?.auth).toEqual({ minRole: 'member' });
    expect(config?.body).toBeDefined();
    expect(config?.requireOrg).toBeUndefined();
    expect(config?.entitlement).toBeUndefined();
  });

  it('is refused for a caller with no active organization before any limit, entitlement, lookup or provider call', async () => {
    caller.organizationId = null;
    const { POST } = await loadRoute();

    const response = await POST(new NextRequest('http://localhost/api/ai/summarize', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: 'abc' }) }));

    expect(response.status).toBe(403);
    expect(m.checkRateLimit).not.toHaveBeenCalled();
    expect(m.checkEntitlement).not.toHaveBeenCalled();
    expect(m.withRLSContext).not.toHaveBeenCalled();
    expect(m.getAiClient).not.toHaveBeenCalled();
  });

  it('returns 429 when rate-limited', async () => {
    const { POST } = await loadRoute();
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false });

    const response = await POST(new NextRequest('http://localhost/api/ai/summarize', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: 'abc' }) }));
    expect(response.status).toBe(429);
    expect(m.checkRateLimit).toHaveBeenCalledWith('ai-completion:u1', expect.anything());
  });

  it('returns 403 when entitlement denied', async () => {
    const { POST } = await loadRoute();
    m.checkEntitlement.mockResolvedValueOnce({ allowed: false, reason: 'upgrade', upgradeUrl: '/upgrade' });

    const response = await POST(new NextRequest('http://localhost/api/ai/summarize', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: 'abc' }) }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ feature: 'ai_summarize', upgradeUrl: '/upgrade' });
    // The gate is the summarization feature itself (a basic-tier feature), not the search feature every tier holds.
    expect(m.checkEntitlement).toHaveBeenCalledWith('org_1', 'ai_summarize');
    expect(m.getAiClient).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid payload', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/ai/summarize', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) }));
    expect(response.status).toBe(400);
    expect(m.checkRateLimit).not.toHaveBeenCalled();
  });

  it('returns 404 when document_id is missing from knowledge base', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/ai/summarize', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ document_id: DOCUMENT_ID }),
    }));
    expect(response.status).toBe(404);
  });

  it('looks the document up inside the caller\'s organization, by id, active rows only', async () => {
    const { POST } = await loadRoute();
    await POST(new NextRequest('http://localhost/api/ai/summarize', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ document_id: DOCUMENT_ID }),
    }));

    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org_1' }, expect.any(Function));
    expect(m.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: ['and', ['eq', 'kb.id', DOCUMENT_ID], ['eq', 'kb.organizationId', 'org_1'], ['eq', 'kb.isActive', true]],
    }));
  });

  it('does not summarize an exit-interview asset for a caller below the interview sensitivity role', async () => {
    const { POST } = await loadRoute();
    m.findFirst.mockResolvedValue({ content: 'privileged text', title: 'T', organizationId: 'org_1', isPublic: false, sourceType: 'exit_interview', sourceId: 'int-1' });
    m.selectRows.mockReturnValue([{ sensitivityLevel: 'legal_sensitive' }]);
    m.hasMinRole.mockResolvedValue(false);

    const response = await POST(new NextRequest('http://localhost/api/ai/summarize', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ document_id: DOCUMENT_ID }),
    }));

    expect(response.status).toBe(404);
    expect(m.hasMinRole).toHaveBeenCalledWith('admin');
    expect(m.getAiClient).not.toHaveBeenCalled();
  });

  it('summarizes an exit-interview asset for a caller who holds the required role', async () => {
    const { POST } = await loadRoute();
    m.findFirst.mockResolvedValue({ content: 'internal text', title: 'T', organizationId: 'org_1', isPublic: false, sourceType: 'exit_interview', sourceId: 'int-1' });
    m.selectRows.mockReturnValue([{ sensitivityLevel: 'public_internal' }]);
    m.hasMinRole.mockResolvedValue(true);

    const response = await POST(new NextRequest('http://localhost/api/ai/summarize', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ document_id: DOCUMENT_ID }),
    }));

    expect(response.status).toBe(200);
    expect(m.hasMinRole).toHaveBeenCalledWith('member');
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

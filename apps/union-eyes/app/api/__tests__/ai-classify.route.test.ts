import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  checkEntitlement: vi.fn(),
  classifyClause: vi.fn(),
  generateClauseTags: vi.fn(),
  detectCrossReferences: vi.fn(),
  classifyPrecedent: vi.fn(),
  enrichClauseMetadata: vi.fn(),
  batchClassifyClauses: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({
  withRoleAuth: vi.fn((_: string, handler: (req: NextRequest, ctx: any) => Promise<Response>) => (req: NextRequest, ctx: any = { userId: 'u1', organizationId: 'org_1' }) => handler(req, ctx)),
}));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  RATE_LIMITS: { AI_COMPLETION: { requests: 30, window: 60 } },
  createRateLimitHeaders: vi.fn(() => ({})),
}));
vi.mock('@/lib/services/entitlements', () => ({ checkEntitlement: m.checkEntitlement }));
vi.mock('@/lib/services/ai/auto-classification-service', () => ({
  classifyClause: m.classifyClause,
  generateClauseTags: m.generateClauseTags,
  detectCrossReferences: m.detectCrossReferences,
  classifyPrecedent: m.classifyPrecedent,
  enrichClauseMetadata: m.enrichClauseMetadata,
  batchClassifyClauses: m.batchClassifyClauses,
}));

async function loadRoute() {
  return import('../ai/classify/route');
}

describe('ai/classify route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 0 });
    m.checkEntitlement.mockResolvedValue({ allowed: true });
    m.classifyClause.mockResolvedValue({ category: 'discipline' });
    m.generateClauseTags.mockResolvedValue(['tag1']);
    m.detectCrossReferences.mockResolvedValue(['ref1']);
    m.classifyPrecedent.mockResolvedValue({ type: 'binding' });
    m.enrichClauseMetadata.mockResolvedValue({ score: 0.9 });
    m.batchClassifyClauses.mockResolvedValue(new Map([['c1', { category: 'x' }]]));
  });

  it('returns 429 when rate limit is exceeded', async () => {
    const { POST } = await loadRoute();
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false, resetIn: 10 });

    const response = await POST(new NextRequest('http://localhost/api/ai/classify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'classify-clause', content: 'abc' }),
    }), { userId: 'u1', organizationId: 'org_1' } as any);

    expect(response.status).toBe(429);
  });

  it('returns 403 when entitlement check fails', async () => {
    const { POST } = await loadRoute();
    m.checkEntitlement.mockResolvedValueOnce({ allowed: false, reason: 'Upgrade required', upgradeUrl: '/upgrade' });

    const response = await POST(new NextRequest('http://localhost/api/ai/classify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'classify-clause', content: 'abc' }),
    }), { userId: 'u1', organizationId: 'org_1' } as any);

    expect(response.status).toBe(403);
  });

  it('returns validation error when required action payload is missing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/ai/classify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'classify-clause' }),
    }), { userId: 'u1', organizationId: 'org_1' } as any);

    expect(response.status).toBe(400);
  });

  it('returns classify-clause result on success', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/ai/classify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'classify-clause', content: 'Sample clause content' }),
    }), { userId: 'u1', organizationId: 'org_1' } as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.action).toBe('classify-clause');
  });

  it('returns batch-classify result with progress counters', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/ai/classify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'batch-classify', clauses: [{ id: 'c1', content: 'x' }] }),
    }), { userId: 'u1', organizationId: 'org_1' } as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.action).toBe('batch-classify');
    expect(payload.total).toBe(1);
  });
});

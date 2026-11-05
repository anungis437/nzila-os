import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const TEST_ORG_ID = '00000000-0000-0000-0000-000000000001';
const CBA_ID = '11111111-1111-1111-1111-111111111111';

const m = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  createRateLimitHeaders: vi.fn(),
  checkEntitlement: vi.fn(),
  guardAiFeature: vi.fn(),
  enforceAISafety: vi.fn(),
  extractClausesFromPDF: vi.fn(),
  batchExtractClauses: vi.fn(),
}));

vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule);
vi.mock('@/lib/rate-limiter', () => ({ checkRateLimit: m.checkRateLimit, RATE_LIMITS: { AI_COMPLETION: { limit: 10 } }, createRateLimitHeaders: m.createRateLimitHeaders }));
vi.mock('@/lib/services/entitlements', () => ({ checkEntitlement: m.checkEntitlement }));
vi.mock('@/lib/ai/ai-feature-guard', () => ({ guardAiFeature: m.guardAiFeature }));
vi.mock('@/lib/services/feature-flags', () => ({ AI_FEATURES: { AI_EXTRACT_CLAUSES: 'AI_EXTRACT_CLAUSES' } }));
vi.mock('@nzila/policies', () => ({ enforceAISafety: m.enforceAISafety }));
vi.mock('@/lib/services/ai/clause-extraction-service', () => ({ extractClausesFromPDF: m.extractClausesFromPDF, batchExtractClauses: m.batchExtractClauses }));

const { caller, declared, resetCaller } = await import('./support/with-api-stub');

async function loadRoute() {
  return import('../ai/extract-clauses/route');
}

const post = (body: unknown) => new NextRequest('http://localhost/api/ai/extract-clauses', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

describe('ai/extract-clauses route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCaller();
    caller.role = 'steward';
    caller.organizationId = TEST_ORG_ID;
    m.checkRateLimit.mockResolvedValue({ allowed: true });
    m.createRateLimitHeaders.mockReturnValue({});
    m.checkEntitlement.mockResolvedValue({ allowed: true });
    m.guardAiFeature.mockResolvedValue(null);
    m.extractClausesFromPDF.mockResolvedValue({ success: true, totalClauses: 3, clauses: [], errors: [], processingTime: 100 });
    m.batchExtractClauses.mockReturnValue(new Map([['c1', { success: true, totalClauses: 2 }]]));
    m.enforceAISafety.mockReturnValue(undefined);
  });

  it('declares what it asks of the wrapper: a steward and a validated body, with the entitlement left to the handler (it answers with the upgrade address)', async () => {
    await loadRoute();
    const config = declared.find((entry) => entry.openapi?.summary === 'Extract clauses from a CBA document with AI');
    expect(config?.auth).toEqual({ minRole: 'steward' });
    expect(config?.body).toBeDefined();
    expect(config?.entitlement).toBeUndefined();
  });

  it('refuses a member before any limit, entitlement or extraction is touched', async () => {
    caller.role = 'member';
    const { POST } = await loadRoute();
    const response = await POST(post({ pdfUrl: 'http://x.com/a.pdf', cbaId: CBA_ID }));
    expect(response.status).toBe(403);
    expect(m.checkRateLimit).not.toHaveBeenCalled();
    expect(m.checkEntitlement).not.toHaveBeenCalled();
    expect(m.extractClausesFromPDF).not.toHaveBeenCalled();
  });

  it('returns 429 when rate-limited', async () => {
    const { POST } = await loadRoute();
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false });
    const response = await POST(post({ pdfUrl: 'http://x.com/a.pdf', cbaId: CBA_ID, organizationId: TEST_ORG_ID }));
    expect(response.status).toBe(429);
    expect(m.checkEntitlement).not.toHaveBeenCalled();
  });

  it('returns forbidden when entitlement is missing', async () => {
    const { POST } = await loadRoute();
    m.checkEntitlement.mockResolvedValueOnce({ allowed: false, reason: 'upgrade required', upgradeUrl: 'https://example.com/upgrade' });

    const response = await POST(post({ pdfUrl: 'http://x.com/a.pdf', cbaId: CBA_ID, organizationId: TEST_ORG_ID }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ feature: 'ai_extract_clauses', error: 'upgrade required' });
    expect(m.extractClausesFromPDF).not.toHaveBeenCalled();
  });

  it('returns validation error for invalid payload before any limit or entitlement is touched', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post({ pdfUrl: 'not-a-url' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(m.checkRateLimit).not.toHaveBeenCalled();
    expect(m.checkEntitlement).not.toHaveBeenCalled();
  });

  it('batches extracts', async () => {
    const { POST } = await loadRoute();
    m.batchExtractClauses.mockReturnValue(new Map([
      ['c1', { success: true, totalClauses: 2 }],
      ['c2', { success: false, totalClauses: 0 }],
    ]));

    const response = await POST(post({ batch: true, cbas: [{ id: '11111111-1111-1111-1111-111111111111', documentUrl: 'http://x.com/1.pdf' }, { id: '22222222-2222-2222-2222-222222222222', documentUrl: 'http://x.com/2.pdf' }], autoSave: false, organizationId: TEST_ORG_ID, cbaId: CBA_ID, pdfUrl: 'http://x.com/a.pdf' }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.batch).toBe(true);
    expect(payload.totalCBAs).toBe(2);
    expect(payload.successfulExtractions).toBe(1);
    expect(m.batchExtractClauses).toHaveBeenCalledWith(
      [{ id: '11111111-1111-1111-1111-111111111111', documentUrl: 'http://x.com/1.pdf' }, { id: '22222222-2222-2222-2222-222222222222', documentUrl: 'http://x.com/2.pdf' }],
      expect.objectContaining({ organizationId: TEST_ORG_ID, userId: 'u1', autoSave: false, concurrency: 3 }),
    );
  });

  it('refuses a body organization that is not the caller organization and extracts nothing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post({ pdfUrl: 'http://x.com/a.pdf', cbaId: CBA_ID, organizationId: '99999999-9999-9999-9999-999999999999' }));
    expect(response.status).toBe(403);
    expect(m.extractClausesFromPDF).not.toHaveBeenCalled();
  });

  it('extracts single pdf', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post({ pdfUrl: 'http://x.com/a.pdf', cbaId: CBA_ID, organizationId: TEST_ORG_ID, autoSave: true }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(m.extractClausesFromPDF).toHaveBeenCalledWith('http://x.com/a.pdf', CBA_ID, { organizationId: TEST_ORG_ID, userId: 'u1', autoSave: true });
  });
});

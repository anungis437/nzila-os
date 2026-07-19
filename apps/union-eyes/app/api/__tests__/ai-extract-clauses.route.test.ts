import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

const TEST_ORG_ID = '00000000-0000-0000-0000-000000000001';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  checkRateLimit: vi.fn(),
  createRateLimitHeaders: vi.fn(),
  checkEntitlement: vi.fn(),
  guardAiFeature: vi.fn(),
  enforceAISafety: vi.fn(),
  extractClausesFromPDF: vi.fn(),
  batchExtractClauses: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withRoleAuth: m.withRoleAuth }));
vi.mock('@/lib/rate-limiter', () => ({ checkRateLimit: m.checkRateLimit, RATE_LIMITS: { AI_COMPLETION: { limit: 10 } }, createRateLimitHeaders: m.createRateLimitHeaders }));
vi.mock('@/lib/services/entitlements', () => ({ checkEntitlement: m.checkEntitlement }));
vi.mock('@/lib/ai/ai-feature-guard', () => ({ guardAiFeature: m.guardAiFeature }));
vi.mock('@/lib/services/feature-flags', () => ({ AI_FEATURES: { AI_EXTRACT_CLAUSES: 'AI_EXTRACT_CLAUSES' } }));
vi.mock('@nzila/policies', () => ({ enforceAISafety: m.enforceAISafety }));
vi.mock('@/lib/services/ai/clause-extraction-service', () => ({ extractClausesFromPDF: m.extractClausesFromPDF, batchExtractClauses: m.batchExtractClauses }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { VALIDATION_ERROR: 'VALIDATION_ERROR', FORBIDDEN: 'FORBIDDEN', INTERNAL_ERROR: 'INTERNAL_ERROR' },
  standardErrorResponse: vi.fn((code: string, message: string, details?: unknown) => {
    const status = code === 'VALIDATION_ERROR' ? 400 : code === 'FORBIDDEN' ? 403 : code === 'INTERNAL_ERROR' ? 500 : 400;
    return NextResponse.json({ code, message, details }, { status });
  }),
}));

async function loadRoute() {
  return import('../ai/extract-clauses/route');
}

describe('ai/extract-clauses route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withRoleAuth.mockImplementation((_role: string, handler: any) => (request: any, context: any = { userId: 'u1', organizationId: TEST_ORG_ID }) => handler(request, context));
    m.checkRateLimit.mockResolvedValue({ allowed: true });
    m.createRateLimitHeaders.mockReturnValue({});
    m.checkEntitlement.mockResolvedValue({ allowed: true });
    m.guardAiFeature.mockResolvedValue(null);
    m.extractClausesFromPDF.mockResolvedValue({ success: true, totalClauses: 3, clauses: [], errors: [], processingTime: 100 });
    m.batchExtractClauses.mockReturnValue(new Map([['c1', { success: true, totalClauses: 2 }]]));
    m.enforceAISafety.mockReturnValue(undefined);
  });

  it('returns 429 when rate-limited', async () => {
    const { POST } = await loadRoute();
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false });
    const response = await POST(new Request('http://localhost/api/ai/extract-clauses', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pdfUrl: 'http://x.com/a.pdf', cbaId: '11111111-1111-1111-1111-111111111111', organizationId: TEST_ORG_ID }),
    }));
    expect(response.status).toBe(429);
    expect(m.checkEntitlement).not.toHaveBeenCalled();
  });

  it('returns forbidden when entitlement is missing', async () => {
    const { POST } = await loadRoute();
    m.checkEntitlement.mockResolvedValueOnce({ allowed: false, reason: 'upgrade required', upgradeUrl: 'https://example.com/upgrade' });

    const response = await POST(new Request('http://localhost/api/ai/extract-clauses', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pdfUrl: 'http://x.com/a.pdf', cbaId: '11111111-1111-1111-1111-111111111111', organizationId: 'org_1' }),
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ feature: 'ai_extract_clauses', error: 'upgrade required' });
  });

  it('returns validation error for invalid payload', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/ai/extract-clauses', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pdfUrl: 'not-a-url' }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('batches extracts', async () => {
    const { POST } = await loadRoute();
    m.batchExtractClauses.mockReturnValue(new Map([
      ['c1', { success: true, totalClauses: 2 }],
      ['c2', { success: false, totalClauses: 0 }],
    ]));

    const response = await POST(new Request('http://localhost/api/ai/extract-clauses', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ batch: true, cbas: [{ id: 'c1' }, { id: 'c2' }], autoSave: false, organizationId: TEST_ORG_ID, cbaId: '11111111-1111-1111-1111-111111111111', pdfUrl: 'http://x.com/a.pdf' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.batch).toBe(true);
    expect(payload.totalCBAs).toBe(2);
    expect(payload.successfulExtractions).toBe(1);
    expect(m.batchExtractClauses).toHaveBeenCalledWith([{ id: 'c1' }, { id: 'c2' }], expect.objectContaining({ autoSave: false, concurrency: 3 }));
  });

  it('extracts single pdf', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/ai/extract-clauses', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pdfUrl: 'http://x.com/a.pdf', cbaId: '11111111-1111-1111-1111-111111111111', organizationId: TEST_ORG_ID, autoSave: true }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(m.extractClausesFromPDF).toHaveBeenCalledWith('http://x.com/a.pdf', '11111111-1111-1111-1111-111111111111', { organizationId: TEST_ORG_ID, autoSave: true });
  });
});

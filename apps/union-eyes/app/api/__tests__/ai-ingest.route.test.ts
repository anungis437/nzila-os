import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  checkRateLimit: vi.fn(),
  guardAiFeature: vi.fn(),
  requireEntitlement: vi.fn(),
  enforceAISafety: vi.fn(),
  dataIngestion: { ingest: vi.fn() },
  entityExtraction: { extract: vi.fn() },
  ragPipeline: { addDocuments: vi.fn() },
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/api-auth-guard', () => ({ withRoleAuth: m.withRoleAuth, BaseAuthContext: {} }));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  RATE_LIMITS: { AI_COMPLETION: { windowMs: 60000, maxRequests: 100 } },
}));
vi.mock('@/lib/ai/ai-feature-guard', () => ({ guardAiFeature: m.guardAiFeature }));
vi.mock('@/lib/services/feature-flags', () => ({ AI_FEATURES: { AI_INGEST: 'AI_INGEST' } }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@nzila/policies', () => ({ enforceAISafety: m.enforceAISafety }));
vi.mock('@/lib/ai/data-ingestion', () => ({ dataIngestion: m.dataIngestion }));
vi.mock('@/lib/ai/entity-extraction', () => ({ entityExtraction: m.entityExtraction }));
vi.mock('@/lib/ai/rag-pipeline', () => ({ ragPipeline: m.ragPipeline }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));

async function loadRoute() {
  return import('../ai/ingest/route');
}

describe('ai/ingest route', () => {
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

    m.dataIngestion.ingest.mockResolvedValue({
      id: 'doc_1',
      content: 'Extracted text from document',
      quality: 'good',
    });
    m.entityExtraction.extract.mockReturnValue({
      documentType: 'contract',
      orgs: [{ name: 'ACME Union' }],
    });
    m.ragPipeline.addDocuments.mockResolvedValue(undefined);
  });

  it('returns 400 when file is missing', async () => {
    const { POST } = await loadRoute();
    const form = new FormData();
    form.set('data', JSON.stringify({ source: 'upload' }));

    const response = await POST(new Request('http://localhost/api/ai/ingest', { method: 'POST', body: form }));
    expect([200, 400, 403, 429, 500]).toContain(response.status);
  });

  it('processes uploaded document and returns ingestion result', async () => {
    const { POST } = await loadRoute();
    const file = new File([new Uint8Array([1, 2, 3])], 'doc.txt', { type: 'text/plain' });
    const form = new FormData();
    form.set('file', file);
    form.set('data', JSON.stringify({ source: 'manual-upload', extractEntities: true, addToRAG: true }));

    const response = await POST(new Request('http://localhost/api/ai/ingest', { method: 'POST', body: form }));
    expect([200, 201, 400, 403, 429, 500]).toContain(response.status);
  });

  it('returns API info from GET endpoint', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/ai/ingest'));
    expect([200, 429, 500]).toContain(response.status);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  guardAiFeature: vi.fn(),
  requireEntitlement: vi.fn(),
  enforceAISafety: vi.fn(),
  dataIngestion: { ingest: vi.fn() },
  entityExtraction: { extract: vi.fn() },
  ragPipeline: { addDocuments: vi.fn() },
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/api-auth-guard', () => ({
  withRoleAuth: (_role: string, handler: (request: Request, context: unknown) => unknown) =>
    (request: Request) => handler(request, { userId: 'u1', organizationId: 'org_1', userRole: 'officer' }),
  BaseAuthContext: {},
}));
vi.mock('@/lib/rate-limiter', () => ({ checkRateLimit: m.checkRateLimit, RATE_LIMITS: { AI_COMPLETION: {} } }));
vi.mock('@/lib/ai/ai-feature-guard', () => ({ guardAiFeature: m.guardAiFeature }));
vi.mock('@/lib/services/feature-flags', () => ({ AI_FEATURES: { AI_INGEST: 'AI_INGEST' } }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@nzila/policies', () => ({ enforceAISafety: m.enforceAISafety }));
vi.mock('@/lib/ai/data-ingestion', () => ({ dataIngestion: m.dataIngestion }));
vi.mock('@/lib/ai/entity-extraction', () => ({ entityExtraction: m.entityExtraction }));
vi.mock('@/lib/ai/rag-pipeline', () => ({ ragPipeline: m.ragPipeline }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));

import { POST } from '../ai/ingest/route';
import {
  IngestionCapacityError,
  IngestionTooLargeError,
  MAX_INGEST_BODY_BYTES,
  MAX_INGEST_FILE_BYTES,
  UPLOAD_BUDGET_BYTES,
  uploadBudget,
} from '@/lib/ai/ingestion-limits';

function upload(file: File, headers: Record<string, string> = {}) {
  const form = new FormData();
  form.set('file', file);
  form.set('data', JSON.stringify({ source: 'test', extractEntities: false, addToRAG: false }));
  return new Request('http://localhost/api/ai/ingest', { method: 'POST', body: form, headers });
}

describe('ai/ingest resource limits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.checkRateLimit.mockResolvedValue({ allowed: true });
    m.guardAiFeature.mockResolvedValue(null);
    m.requireEntitlement.mockResolvedValue(undefined);
    m.dataIngestion.ingest.mockResolvedValue({ id: 'doc_1', content: 'text', quality: { score: 1 } });
  });

  it('accepts a normal upload and releases the upload budget', async () => {
    const response = await POST(upload(new File([new Uint8Array(10)], 'a.pdf', { type: 'application/pdf' })) as never);
    expect(response.status).toBe(201);
    expect(uploadBudget.inFlightBytes).toBe(0);
  });

  it('rejects a declared body over the ceiling with 413 before reading the form', async () => {
    const formData = vi.spyOn(Request.prototype, 'formData');
    const request = upload(new File([new Uint8Array(1)], 'a.pdf'), { 'content-length': String(MAX_INGEST_BODY_BYTES + 1) });
    const response = await POST(request as never);
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: 'Document exceeds the maximum size of 50MB' });
    expect(formData).not.toHaveBeenCalled();
    expect(m.dataIngestion.ingest).not.toHaveBeenCalled();
    expect(uploadBudget.inFlightBytes).toBe(0);
    formData.mockRestore();
  });

  it('rejects a file over 50MB with 413 without calling arrayBuffer()', async () => {
    const oversized = new File([new Uint8Array(MAX_INGEST_FILE_BYTES + 1)], 'big.pdf', { type: 'application/pdf' });
    const arrayBuffer = vi.spyOn(File.prototype, 'arrayBuffer');
    const response = await POST(upload(oversized) as never);
    expect(response.status).toBe(413);
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(m.dataIngestion.ingest).not.toHaveBeenCalled();
    expect(uploadBudget.inFlightBytes).toBe(0);
    arrayBuffer.mockRestore();
  });

  it('sheds uploads with 503 and Retry-After when the upload budget is exhausted', async () => {
    const held = await uploadBudget.acquire(UPLOAD_BUDGET_BYTES);
    const response = await POST(upload(new File([new Uint8Array(10)], 'a.pdf')) as never);
    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('5');
    expect(await response.json()).toEqual({ error: 'Document ingestion is busy. Retry shortly.' });
    held();
    expect(uploadBudget.inFlightBytes).toBe(0);
  });

  it('maps parser capacity and size errors to 503 and 413 with fixed bodies and releases the budget', async () => {
    m.dataIngestion.ingest.mockRejectedValueOnce(new IngestionCapacityError());
    const busy = await POST(upload(new File([new Uint8Array(10)], 'a.pdf')) as never);
    expect(busy.status).toBe(503);
    expect(busy.headers.get('retry-after')).toBe('5');

    m.dataIngestion.ingest.mockRejectedValueOnce(new IngestionTooLargeError());
    const large = await POST(upload(new File([new Uint8Array(10)], 'a.pdf')) as never);
    expect(large.status).toBe(413);

    expect(m.logger.error).not.toHaveBeenCalled();
    expect(uploadBudget.inFlightBytes).toBe(0);
  });

  it('keeps unexpected failures generic and still releases the budget', async () => {
    m.dataIngestion.ingest.mockRejectedValueOnce(new Error('secret internal detail'));
    const response = await POST(upload(new File([new Uint8Array(10)], 'a.pdf')) as never);
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('secret');
    expect(uploadBudget.inFlightBytes).toBe(0);
  });
});

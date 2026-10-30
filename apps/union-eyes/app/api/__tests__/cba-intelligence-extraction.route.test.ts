import { describe, expect, it, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  extractDocument: vi.fn(),
  runBulkExtraction: vi.fn(),
  operation: vi.fn(),
  requireSystemAdmin: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  z: require('zod'),
  ApiError: { conflict: (message: string) => Object.assign(new Error(message), { status: 409 }) },
}));
vi.mock('@/lib/api-auth-guard', () => ({ requireSystemAdmin: () => m.requireSystemAdmin() }));
vi.mock('@/lib/audit/operation-audit', () => ({
  performAuditedOperation: m.operation,
  operationAuditResponse: (e: unknown) =>
    (e as { code?: string })?.code === 'OPERATION_AUDIT_UNAVAILABLE'
      ? { status: 409, body: { error: { code: 'OPERATION_AUDIT_UNAVAILABLE', message: 'not performed' } } }
      : null,
}));
vi.mock('@/lib/services/cba-intelligence/extraction-orchestrator', () => ({
  extractDocument: m.extractDocument,
  runBulkExtraction: m.runBulkExtraction,
}));

async function loadRoute() {
  return import('../cba-intelligence/extraction/route');
}

describe('cba-intelligence/extraction route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireSystemAdmin.mockResolvedValue(undefined);
    m.withApi.mockImplementation((_cfg: unknown, handler: any) => (ctx: any = {}) => handler(ctx));
    m.extractDocument.mockResolvedValue({ status: 'extracted', documentId: 'd1' });
    m.runBulkExtraction.mockResolvedValue({ processed: 3 });
    m.operation.mockImplementation(async (_op: unknown, fn: () => Promise<unknown>) => fn());
  });

  it('records the intent before running and attributes it to the acting administrator', async () => {
    const { POST } = await loadRoute();
    await POST({ body: { documentId: '11111111-1111-1111-1111-111111111111' }, userId: 'u1', organizationId: 'org-1' });
    expect(m.operation).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1', userId: 'u1', action: 'cba_intel.extraction.run_document', resourceId: '11111111-1111-1111-1111-111111111111' }),
      expect.any(Function),
    );
  });

  it('runs nothing when the intent cannot be recorded', async () => {
    const { POST } = await loadRoute();
    m.operation.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'OPERATION_AUDIT_UNAVAILABLE' }));
    await expect(POST({ body: undefined, userId: 'u1', organizationId: 'org-1' })).rejects.toMatchObject({ status: 409 });
    expect(m.runBulkExtraction).not.toHaveBeenCalled();
    expect(m.extractDocument).not.toHaveBeenCalled();
  });

  it('runs bulk extraction when no documentId', async () => {
    const { POST } = await loadRoute();
    const result = await POST({ body: undefined });
    expect(result.data).toBeDefined();
  });

  it('extracts single document when documentId provided', async () => {
    const { POST } = await loadRoute();
    const result = await POST({ body: { documentId: '11111111-1111-1111-1111-111111111111' } });
    expect(result.data).toBeDefined();
  });

  // DEF-0B4-CBA-INTEL-TENANT-ADMIN-WRITES-SHARED-DATASET: extraction writes the platform-wide dataset, so an organization administrator is refused.
  it('refuses a caller who is not a platform administrator and extracts nothing', async () => {
    m.requireSystemAdmin.mockRejectedValue(Object.assign(new Error('System administrator privileges required'), { status: 403 }));
    const { POST } = await loadRoute();
    await expect(POST({ body: {}, userId: 'u1', organizationId: 'org-1' })).rejects.toMatchObject({ status: 403 });
    expect(m.operation).not.toHaveBeenCalled();
    expect(m.extractDocument).not.toHaveBeenCalled();
    expect(m.runBulkExtraction).not.toHaveBeenCalled();
  });
});

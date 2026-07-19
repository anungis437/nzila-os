import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withSystemContext: vi.fn(),
  ingestGrievanceBatch: vi.fn(),
  verifyImportBatch: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: {
    badRequest: (message: string) => new Error(message),
    forbidden: (message: string) => new Error(message),
  },
  z: require('zod'),
}));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/lib/ingestion', () => ({ ingestGrievanceBatch: m.ingestGrievanceBatch }));
vi.mock('@/lib/ingestion/post-import-verification', () => ({ verifyImportBatch: m.verifyImportBatch }));

async function loadRoute() {
  return import('../admin/ingest/route');
}

describe('admin/ingest route', () => {
  const baseRecord = {
    external_case_id: 'case-1',
    type: 'grievance',
    status: 'open',
    title: 'Sample Case',
    description: 'Sample Description',
    organization_id: '11111111-1111-1111-1111-111111111111',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.ingestGrievanceBatch.mockResolvedValue({ batchId: 'batch_1', imported: 1, failed: 0 });
    m.verifyImportBatch.mockResolvedValue({ verified: true, issues: [] });
  });

  it('throws when organization context is missing', async () => {
    const { POST } = await loadRoute();

    await expect(POST({ body: { source_system: 'legacy', records: [baseRecord] }, userId: 'u1' })).rejects.toThrow('Organization context required');
  });

  it('throws when any record organization mismatches request organization', async () => {
    const { POST } = await loadRoute();

    await expect(POST({
      organizationId: '22222222-2222-2222-2222-222222222222',
      userId: 'u1',
      body: { source_system: 'legacy', records: [baseRecord] },
    })).rejects.toThrow('targets org');
  });

  it('ingests and verifies for non-dry-run batch', async () => {
    const { POST } = await loadRoute();

    const result = await POST({
      organizationId: '11111111-1111-1111-1111-111111111111',
      userId: 'u1',
      body: { source_system: 'legacy', dry_run: false, continue_on_error: true, records: [baseRecord] },
    });

    expect(result).toMatchObject({ batchId: 'batch_1', verification: { verified: true } });
    expect(m.ingestGrievanceBatch).toHaveBeenCalled();
    expect(m.verifyImportBatch).toHaveBeenCalledWith('batch_1');
  });

  it('skips verification for dry-run ingestion', async () => {
    const { POST } = await loadRoute();
    m.ingestGrievanceBatch.mockResolvedValueOnce({ batchId: 'dry-run', imported: 0, failed: 0 });

    const result = await POST({
      organizationId: '11111111-1111-1111-1111-111111111111',
      userId: 'u1',
      body: { source_system: 'legacy', dry_run: true, continue_on_error: true, records: [baseRecord] },
    });

    expect(result).toMatchObject({ batchId: 'dry-run', verification: null });
    expect(m.verifyImportBatch).not.toHaveBeenCalled();
  });
});
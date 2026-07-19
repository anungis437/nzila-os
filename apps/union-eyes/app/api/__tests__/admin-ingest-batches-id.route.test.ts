import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withSystemContext: vi.fn(),
  getBatchDetail: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, ApiError: { badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }), notFound: (msg: string) => Object.assign(new Error(msg), { status: 404 }) } }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/lib/ingestion/migration-metrics', () => ({ getBatchDetail: m.getBatchDetail }));

async function loadRoute() {
  return import('../admin/ingest/batches/[id]/route');
}

describe('admin/ingest/batches/[id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) =>
      (ctx: any = {}) => handler(ctx));
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.getBatchDetail.mockResolvedValue({ id: 'batch_1', warnings: [] });
  });

  it('throws when organization context is missing', async () => {
    const { GET } = await loadRoute();
    await expect(GET({ params: { id: 'batch_1' } })).rejects.toMatchObject({ status: 400 });
  });

  it('returns batch detail when found', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ params: { id: 'batch_1' }, organizationId: 'org_1' });

    expect(result).toEqual({ id: 'batch_1', warnings: [] });
    expect(m.getBatchDetail).toHaveBeenCalledWith('batch_1', 'org_1');
  });
});
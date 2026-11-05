import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withSystemContext: vi.fn(),
  listBatches: vi.fn(),
  getMetricsSummary: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, ApiError: { badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }) }, z: require('zod') }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/lib/ingestion/migration-metrics', () => ({ listBatches: m.listBatches, getMetricsSummary: m.getMetricsSummary }));

async function loadRoute() {
  return import('../admin/ingest/batches/route');
}

describe('admin/ingest/batches route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.listBatches.mockResolvedValue({ items: [{ id: 'batch_1' }], total: 1 });
    m.getMetricsSummary.mockResolvedValue({ totalBatches: 1 });
  });

  it('returns batch list and metrics', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ query: { status: 'ready', limit: 10, offset: 0 }, organizationId: 'org_1' });

    expect(result).toEqual({ items: [{ id: 'batch_1' }], total: 1, metrics: { totalBatches: 1 } });
    expect(m.listBatches).toHaveBeenCalledWith('org_1', { status: 'ready', limit: 10, offset: 0 });
    expect(m.getMetricsSummary).toHaveBeenCalledWith('org_1');
  });

  it('runs in the caller tenant transaction and never in the system context', async () => {
    vi.resetModules();
    await loadRoute();
    expect(m.withApi).toHaveBeenCalledWith(expect.objectContaining({ rlsOrgContext: true, auth: { minRole: 'admin' } }), expect.any(Function));
    expect(m.withSystemContext).not.toHaveBeenCalled();
  });

  it('answers 400 when the organization context is missing', async () => {
    const { GET } = await loadRoute();
    await expect(GET({ query: { limit: 10, offset: 0 } })).rejects.toMatchObject({ status: 400 });
    expect(m.listBatches).not.toHaveBeenCalled();
  });

  it('propagates a database failure instead of reporting an empty list', async () => {
    const { GET } = await loadRoute();
    m.listBatches.mockRejectedValueOnce(new Error('connection reset'));
    await expect(GET({ query: { limit: 10, offset: 0 }, organizationId: 'org_1' })).rejects.toThrow('connection reset');
  });
});
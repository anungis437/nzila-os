import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withSystemContext: vi.fn(),
  getBatchDetail: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  zUUID: require('zod').guid(),
  ApiError: { badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }), notFound: (msg: string) => Object.assign(new Error(msg), { status: 404 }) },
}));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/lib/ingestion/migration-metrics', () => ({ getBatchDetail: m.getBatchDetail }));

const BATCH_ID = '4f0b1e0a-5b1c-4c2e-9a53-0f4d3a1d7a10';

async function loadRoute() {
  return import('../admin/ingest/batches/[id]/route');
}

describe('admin/ingest/batches/[id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) =>
      (ctx: any = {}) => handler(ctx));
    m.getBatchDetail.mockResolvedValue({ id: BATCH_ID, warnings: [] });
  });

  it('runs in the caller tenant transaction and never in the system context', async () => {
    vi.resetModules();
    const { GET } = await loadRoute();
    await GET({ params: { id: BATCH_ID }, organizationId: 'org_1' });

    expect(m.withApi).toHaveBeenCalledWith(expect.objectContaining({ rlsOrgContext: true, auth: { minRole: 'admin' } }), expect.any(Function));
    expect(m.withSystemContext).not.toHaveBeenCalled();
  });

  it('throws when organization context is missing', async () => {
    const { GET } = await loadRoute();
    await expect(GET({ params: { id: BATCH_ID } })).rejects.toMatchObject({ status: 400 });
  });

  it('answers 400 for an id that is not a UUID instead of letting it reach the database', async () => {
    const { GET } = await loadRoute();
    await expect(GET({ params: { id: 'batch_1' }, organizationId: 'org_1' })).rejects.toMatchObject({ status: 400 });
    expect(m.getBatchDetail).not.toHaveBeenCalled();
  });

  it('answers 404 when the batch is not found for the organization', async () => {
    const { GET } = await loadRoute();
    m.getBatchDetail.mockResolvedValueOnce(null);
    await expect(GET({ params: { id: BATCH_ID }, organizationId: 'org_1' })).rejects.toMatchObject({ status: 404 });
  });

  it('returns batch detail when found', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ params: { id: BATCH_ID }, organizationId: 'org_1' });

    expect(result).toEqual({ id: BATCH_ID, warnings: [] });
    expect(m.getBatchDetail).toHaveBeenCalledWith(BATCH_ID, 'org_1');
  });
});
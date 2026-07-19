import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  listDocuments: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, z: require('zod') }));
vi.mock('@/lib/services/cba-intelligence/document-service', () => ({ listDocuments: m.listDocuments }));

async function loadRoute() {
  return import('../cba-intelligence/documents/route');
}

describe('cba-intelligence/documents route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.listDocuments.mockResolvedValue({ items: [{ id: 'doc_1' }], pagination: { page: 1, limit: 20 } });
  });

  it('calls listDocuments with empty filters and undefined pagination when omitted', async () => {
    const { GET } = await loadRoute();

    const result = await GET({ query: {} });

    expect(m.listDocuments).toHaveBeenCalledWith({}, { page: undefined, limit: undefined });
    expect(result).toMatchObject({ data: { items: [{ id: 'doc_1' }] } });
  });

  it('passes filters and pagination from query', async () => {
    const { GET } = await loadRoute();

    await GET({
      query: {
        page: 2,
        limit: 10,
        sourceId: '11111111-1111-1111-1111-111111111111',
        documentType: 'cba',
        processingStatus: 'processed',
        jurisdiction: 'QC',
        sector: 'health',
        language: 'fr',
        isLatest: true,
      },
    });

    expect(m.listDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ sourceId: '11111111-1111-1111-1111-111111111111', isLatest: true, jurisdiction: 'QC' }),
      { page: 2, limit: 10 },
    );
  });
});
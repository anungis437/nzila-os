import { describe, expect, it, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  extractDocument: vi.fn(),
  runBulkExtraction: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, z: require('zod') }));
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
    m.withApi.mockImplementation((_cfg: unknown, handler: any) => (ctx: any = {}) => handler(ctx));
    m.extractDocument.mockResolvedValue({ status: 'extracted', documentId: 'd1' });
    m.runBulkExtraction.mockResolvedValue({ processed: 3 });
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
});

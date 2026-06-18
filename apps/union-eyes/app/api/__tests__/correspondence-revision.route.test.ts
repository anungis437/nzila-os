import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  getCorrespondenceById: vi.fn(),
  requestRevision: vi.fn(),
}));

vi.mock('@/lib/api/with-api', () => ({ withApi: m.withApi }));
vi.mock('@/lib/api/errors', () => ({
  ApiError: {
    badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }),
    notFound: (msg: string) => Object.assign(new Error(msg), { status: 404 }),
  },
}));
vi.mock('@/lib/services/correspondence-service', () => ({
  getCorrespondenceById: m.getCorrespondenceById,
  requestRevision: m.requestRevision,
}));

async function loadRoute() {
  return import('../correspondence/[id]/revision/route');
}

describe('correspondence/[id]/revision route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.getCorrespondenceById.mockResolvedValue({ id: 'c_1', organizationId: 'org_1' });
    m.requestRevision.mockResolvedValue({ id: 'c_1', status: 'revision_requested' });
  });

  it('requests revision for correspondence', async () => {
    const { POST } = await loadRoute();
    const result = await POST({
      params: { id: 'c_1' },
      organizationId: 'org_1',
      userId: 'u1',
      user: { name: 'Ada', role: 'officer' },
      body: { reason: 'Needs changes' },
      request: new Request('http://localhost/api/correspondence/c_1/revision', { headers: { 'x-forwarded-for': '1.2.3.4', 'user-agent': 'vitest' } }),
    });

    expect(result).toEqual({ data: { id: 'c_1', status: 'revision_requested' } });
    expect(m.requestRevision).toHaveBeenCalledWith('c_1', 'Needs changes', expect.any(Object));
  });
});
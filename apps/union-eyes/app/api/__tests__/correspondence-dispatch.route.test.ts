import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  getCorrespondenceById: vi.fn(),
  dispatchCorrespondence: vi.fn(),
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
  dispatchCorrespondence: m.dispatchCorrespondence,
}));

async function loadRoute() {
  return import('../correspondence/[id]/dispatch/route');
}

describe('correspondence/[id]/dispatch route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.getCorrespondenceById.mockResolvedValue({ id: 'c_1', organizationId: 'org_1' });
    m.dispatchCorrespondence.mockResolvedValue({ id: 'c_1', status: 'dispatched' });
  });

  it('dispatches signed correspondence', async () => {
    const { POST } = await loadRoute();
    const result = await POST({
      params: { id: 'c_1' },
      organizationId: 'org_1',
      userId: 'u1',
      user: { name: 'Ada', role: 'steward' },
      body: { dispatchMethod: 'email', signedPdfUrl: 'https://example.com/doc.pdf' },
      request: new Request('http://localhost/api/correspondence/c_1/dispatch', { headers: { 'x-forwarded-for': '1.2.3.4', 'user-agent': 'vitest' } }),
    });

    expect(result).toEqual({ data: { id: 'c_1', status: 'dispatched' } });
    expect(m.dispatchCorrespondence).toHaveBeenCalledWith('c_1', expect.objectContaining({ dispatchMethod: 'email' }));
  });
});
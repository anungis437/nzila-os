import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  getCorrespondenceById: vi.fn(),
  cancelCorrespondence: vi.fn(),
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
  cancelCorrespondence: m.cancelCorrespondence,
}));

async function loadRoute() {
  return import('../correspondence/[id]/cancel/route');
}

describe('correspondence/[id]/cancel route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.getCorrespondenceById.mockResolvedValue({ id: 'c_1', organizationId: 'org_1' });
    m.cancelCorrespondence.mockResolvedValue({ id: 'c_1', status: 'cancelled' });
  });

  it('cancels correspondence for the current organization', async () => {
    const { POST } = await loadRoute();
    const result = await POST({
      params: { id: 'c_1' },
      organizationId: 'org_1',
      userId: 'u1',
      user: { name: 'Ada', role: 'steward' },
      body: { reason: 'No longer needed' },
      request: new Request('http://localhost/api/correspondence/c_1/cancel', { headers: { 'x-forwarded-for': '1.2.3.4', 'user-agent': 'vitest' } }),
    });

    expect(result).toEqual({ data: { id: 'c_1', status: 'cancelled' } });
    expect(m.cancelCorrespondence).toHaveBeenCalledWith('c_1', 'No longer needed', expect.any(Object));
  });
});
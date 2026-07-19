import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  getCorrespondenceById: vi.fn(),
  approveCorrespondence: vi.fn(),
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
  approveCorrespondence: m.approveCorrespondence,
}));

async function loadRoute() {
  return import('../correspondence/[id]/approve/route');
}

describe('correspondence/[id]/approve route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) =>
      (ctx: any = {}) => handler(ctx));
    m.getCorrespondenceById.mockResolvedValue({ id: 'c_1', organizationId: 'org_1' });
    m.approveCorrespondence.mockResolvedValue({ id: 'c_1', status: 'approved' });
  });

  it('throws when id is missing', async () => {
    const { POST } = await loadRoute();
    await expect(POST({ params: {} as any, organizationId: 'org_1', userId: 'u1', user: { name: 'Ada', role: 'officer' }, request: new Request('http://localhost') })).rejects.toMatchObject({ status: 400 });
  });

  it('approves correspondence for the current organization', async () => {
    const { POST } = await loadRoute();
    const response = await POST({
      params: { id: 'c_1' },
      organizationId: 'org_1',
      userId: 'u1',
      user: { name: 'Ada', role: 'officer' },
      request: new Request('http://localhost/api/correspondence/c_1/approve', { headers: { 'x-forwarded-for': '1.2.3.4', 'user-agent': 'vitest' } }),
    });

    expect(response).toEqual({ data: { id: 'c_1', status: 'approved' } });
    expect(m.approveCorrespondence).toHaveBeenCalledWith('c_1', expect.objectContaining({ actorUserId: 'u1', actorName: 'Ada', actorRole: 'officer' }));
  });
});
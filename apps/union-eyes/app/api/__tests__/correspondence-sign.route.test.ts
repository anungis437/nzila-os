import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  getCorrespondenceById: vi.fn(),
  signCorrespondence: vi.fn(),
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
  signCorrespondence: m.signCorrespondence,
}));

async function loadRoute() {
  return import('../correspondence/[id]/sign/route');
}

describe('correspondence/[id]/sign route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.getCorrespondenceById.mockResolvedValue({ id: 'c_1', organizationId: 'org_1' });
    m.signCorrespondence.mockResolvedValue({ id: 'c_1', status: 'signed' });
  });

  it('signs correspondence with a stored signature', async () => {
    const { POST } = await loadRoute();
    const result = await POST({
      params: { id: 'c_1' },
      organizationId: 'org_1',
      userId: 'u1',
      user: { name: 'Ada', role: 'officer' },
      body: { signatureId: '550e8400-e29b-41d4-a716-446655440000' },
      request: new Request('http://localhost/api/correspondence/c_1/sign', { headers: { 'x-forwarded-for': '1.2.3.4', 'user-agent': 'vitest' } }),
    });

    expect(result).toEqual({ data: { id: 'c_1', status: 'signed' } });
    expect(m.signCorrespondence).toHaveBeenCalledWith('c_1', expect.objectContaining({ signatureId: '550e8400-e29b-41d4-a716-446655440000' }));
  });
});
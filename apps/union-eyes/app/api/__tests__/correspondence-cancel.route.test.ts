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

const ID = '9f2c4b6e-1111-4222-8333-444455556666';

async function loadRoute() {
  return import('../correspondence/[id]/cancel/route');
}

const cancelCtx = (overrides: Record<string, unknown> = {}) => ({
  params: { id: ID },
  organizationId: 'org_1',
  userId: 'u1',
  user: { name: 'Ada', role: 'steward' },
  body: { reason: 'No longer needed' },
  request: new Request(`http://localhost/api/correspondence/${ID}/cancel`, { headers: { 'x-forwarded-for': '1.2.3.4', 'user-agent': 'vitest' } }),
  ...overrides,
});

describe('correspondence/[id]/cancel route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.getCorrespondenceById.mockResolvedValue({ id: ID, organizationId: 'org_1' });
    m.cancelCorrespondence.mockResolvedValue({ id: ID, status: 'cancelled' });
  });

  it('cancels correspondence for the current organization', async () => {
    const { POST } = await loadRoute();
    const result = await POST(cancelCtx());

    expect(result).toEqual({ data: { id: ID, status: 'cancelled' } });
    expect(m.cancelCorrespondence).toHaveBeenCalledWith(ID, 'No longer needed', expect.any(Object));
  });

  it('runs in the caller tenant transaction: the ownership read and the cancellation are tenant work', async () => {
    vi.resetModules();
    await loadRoute();
    expect(m.withApi).toHaveBeenCalledWith(
      expect.objectContaining({ rlsOrgContext: true, auth: expect.objectContaining({ minRole: 'steward' }) }),
      expect.any(Function),
    );
  });

  it('answers 404 for a correspondence of another organization, and cancels nothing', async () => {
    const { POST } = await loadRoute();
    m.getCorrespondenceById.mockResolvedValueOnce({ id: ID, organizationId: 'org_2' });
    await expect(POST(cancelCtx())).rejects.toMatchObject({ status: 404 });
    expect(m.cancelCorrespondence).not.toHaveBeenCalled();
  });

  it('answers 400 for an id that is missing or not a uuid, before any database read', async () => {
    const { POST } = await loadRoute();
    await expect(POST(cancelCtx({ params: {} }))).rejects.toMatchObject({ status: 400 });
    await expect(POST(cancelCtx({ params: { id: 'c_1' } }))).rejects.toMatchObject({ status: 400 });
    expect(m.getCorrespondenceById).not.toHaveBeenCalled();
    expect(m.cancelCorrespondence).not.toHaveBeenCalled();
  });
});

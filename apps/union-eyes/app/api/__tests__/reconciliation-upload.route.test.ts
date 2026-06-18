import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  listExceptions: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, ApiError: { badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }) } }));
vi.mock('@/services/platform-economics', () => ({ listExceptions: m.listExceptions }));

async function loadRoute() {
  return import('../reconciliation/upload/route');
}

describe('reconciliation/upload route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.listExceptions.mockResolvedValue([{ id: 'ex_1', status: 'open' }]);
  });

  it('lists reconciliation exceptions', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ request: new Request('http://localhost/api/reconciliation/upload?status=open,under_review'), organizationId: 'org_1' });

    expect(result).toEqual({ exceptions: [{ id: 'ex_1', status: 'open' }] });
    expect(m.listExceptions).toHaveBeenCalledWith('org_1', ['open', 'under_review']);
  });
});
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => {
  const state = { selectRows: [] as unknown[][] };
  const createSelectChain = () => {
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(async () => (state.selectRows.shift() ?? []) as unknown[]),
    };
    return chain;
  };
  return {
    state,
    withApi: vi.fn(),
    db: { select: vi.fn(() => createSelectChain()) },
    pauseSubscription: vi.fn(),
    resumeSubscription: vi.fn(),
  };
});

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: { badRequest: (message: string) => new Error(message) },
  RATE_LIMITS: { FINANCIAL_WRITE: { requests: 20, window: 60 } },
  z: require('zod'),
}));
vi.mock('@/db', () => ({ db: m.db }));
vi.mock('@/db/schema', () => ({ orgSubscriptions: { organizationId: 'organizationId', createdAt: 'createdAt' } }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), desc: vi.fn(() => 'desc') };
});
vi.mock('@/services/platform-economics', () => ({
  pauseSubscription: m.pauseSubscription,
  resumeSubscription: m.resumeSubscription,
}));

async function loadRoute() {
  return import('../billing/subscriptions/route');
}

describe('billing/subscriptions route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.state.selectRows = [];
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.pauseSubscription.mockResolvedValue({ ok: true, status: 'paused' });
    m.resumeSubscription.mockResolvedValue({ ok: true, status: 'active' });
  });

  it('GET throws when organization context is missing', async () => {
    const { GET } = await loadRoute();

    await expect(GET({})).rejects.toThrow('Organization context required');
  });

  it('GET returns organization subscriptions', async () => {
    const { GET } = await loadRoute();
    m.state.selectRows.push([{ id: 'sub_1' }]);

    const result = await GET({ organizationId: 'org_1' });

    expect(result).toMatchObject({ subscriptions: [{ id: 'sub_1' }] });
  });

  it('POST throws when organization context is missing', async () => {
    const { POST } = await loadRoute();

    await expect(
      POST({ body: { subscriptionId: '11111111-1111-1111-1111-111111111111', action: 'pause' }, userId: 'u1' }),
    ).rejects.toThrow('Organization context required');
  });

  it('POST pauses subscription when action is pause, scoped to the callers organization (PR #752 IDOR fix)', async () => {
    const { POST } = await loadRoute();

    const result = await POST({
      body: { subscriptionId: '11111111-1111-1111-1111-111111111111', action: 'pause', reason: 'maintenance' },
      userId: 'u1',
      organizationId: 'org_1',
    });

    expect(result).toMatchObject({ ok: true, status: 'paused' });
    expect(m.pauseSubscription).toHaveBeenCalledWith('org_1', '11111111-1111-1111-1111-111111111111', 'u1', 'maintenance');
  });

  it('POST resumes subscription when action is resume, scoped to the callers organization (PR #752 IDOR fix)', async () => {
    const { POST } = await loadRoute();

    const result = await POST({
      body: { subscriptionId: '11111111-1111-1111-1111-111111111111', action: 'resume' },
      userId: 'u1',
      organizationId: 'org_1',
    });

    expect(result).toMatchObject({ ok: true, status: 'active' });
    expect(m.resumeSubscription).toHaveBeenCalledWith('org_1', '11111111-1111-1111-1111-111111111111', 'u1');
  });
});
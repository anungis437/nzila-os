import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const TEST_USER = {
  userId: 'user_test_001',
  organizationId: '00000000-0000-0000-0000-000000000001',
  role: 'member',
};

const m = vi.hoisted(() => {
  const state = {
    selectQueue: [] as unknown[][],
    insertQueue: [] as unknown[][],
    updateQueue: [] as unknown[][],
    deleteQueue: [] as unknown[][],
  };

  const nextSelect = () => Promise.resolve((state.selectQueue.shift() ?? []) as unknown[]);
  const nextInsert = () => Promise.resolve((state.insertQueue.shift() ?? [{ id: 'fallback-campaign' }]) as unknown[]);
  const nextUpdate = () => Promise.resolve((state.updateQueue.shift() ?? [{ id: 'fallback-campaign' }]) as unknown[]);
  const nextDelete = () => Promise.resolve((state.deleteQueue.shift() ?? []) as unknown[]);

  const createSelectChain = () => {
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      offset: vi.fn(() => chain),
      then: (resolve: (value: unknown[]) => unknown) => nextSelect().then(resolve),
    };
    return chain;
  };

  return {
    state,
    checkRateLimit: vi.fn(),
    withRLSContext: vi.fn(async (fn: () => Promise<unknown>) => fn()),
    queueSelect: (...results: unknown[][]) => state.selectQueue.push(...results),
    queueInsert: (...results: unknown[][]) => state.insertQueue.push(...results),
    queueUpdate: (...results: unknown[][]) => state.updateQueue.push(...results),
    queueDelete: (...results: unknown[][]) => state.deleteQueue.push(...results),
    resetQueues: () => {
      state.selectQueue = [];
      state.insertQueue = [];
      state.updateQueue = [];
      state.deleteQueue = [];
    },
    createSelectChain,
    nextInsert,
    nextUpdate,
    nextDelete,
  };
});

const mockDb = {
  select: vi.fn(() => m.createSelectChain()),
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(() => m.nextInsert()),
    })),
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(() => m.nextUpdate()),
      })),
    })),
  })),
  delete: vi.fn(() => ({
    where: vi.fn(() => m.nextDelete()),
  })),
};

vi.mock('@/db', () => ({ db: mockDb }));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  RATE_LIMITS: {
    CAMPAIGN_OPERATIONS: { requests: 30, window: 60 },
  },
}));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: m.withRLSContext,
}));
vi.mock('@/lib/api-auth-guard', async (orig) => {
  const actual = await orig<typeof import('@/lib/api-auth-guard')>();
  return {
    ...actual,
    withRoleAuth: vi.fn(
      (_role: string, handler: (req: NextRequest, ctx: typeof TEST_USER) => Promise<Response>) =>
        (req: NextRequest, ctx: Partial<typeof TEST_USER> = {}) => handler(req, { ...TEST_USER, ...ctx })
    ),
  };
});

async function loadRoute() {
  return import('../social-media/campaigns/route');
}

describe('social-media/campaigns route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.resetQueues();
    m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 0, remaining: 99 });
  });

  it('returns forbidden when organization context is missing', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/social-media/campaigns'), {
      ...TEST_USER,
      organizationId: '',
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('returns rate limit error when reads are throttled', async () => {
    const { GET } = await loadRoute();
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false, resetIn: 17 });

    const response = await GET(new NextRequest('http://localhost/api/social-media/campaigns'));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({ code: 'RATE_LIMIT_EXCEEDED' });
  });

  it('lists campaigns with computed post metrics', async () => {
    const { GET } = await loadRoute();
    m.queueSelect(
      [{ total: 1 }],
      [{
        id: 'camp-1',
        organizationId: TEST_USER.organizationId,
        name: 'Organizing Drive',
        description: 'Summer organizing outreach',
        status: 'active',
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
      }],
      [{ impressionsCount: 200, likesCount: 20, commentsCount: 5, sharesCount: 3 }],
    );

    const response = await GET(new NextRequest('http://localhost/api/social-media/campaigns?limit=10&offset=0'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.total).toBe(1);
    expect(payload.campaigns).toHaveLength(1);
    expect(payload.campaigns[0].metrics).toMatchObject({
      total_posts: 1,
      total_impressions: 200,
      total_engagement: 28,
    });
  });

  it('rejects campaign creation without platforms', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/social-media/campaigns', {
      method: 'POST',
      body: JSON.stringify({ name: 'Campaign Without Platforms' }),
      headers: { 'content-type': 'application/json' },
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'MISSING_REQUIRED_FIELD' });
  });

  it('creates a campaign and returns standardized success payload', async () => {
    const { POST } = await loadRoute();
    m.queueInsert([
      {
        id: 'camp-1',
        name: 'Summer Mobilization',
        organizationId: TEST_USER.organizationId,
        status: 'active',
      },
    ]);

    const response = await POST(new NextRequest('http://localhost/api/social-media/campaigns', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Summer Mobilization',
        description: 'Member outreach campaign',
        platforms: ['facebook', 'instagram'],
        goals: [{ metric: 'impressions', target_value: 10000 }],
      }),
      headers: { 'content-type': 'application/json' },
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.campaign).toMatchObject({ id: 'camp-1', name: 'Summer Mobilization' });
  });

  it('returns validation error when campaign start date is after end date', async () => {
    const { PUT } = await loadRoute();
    m.queueSelect([
      { id: 'camp-1', organizationId: TEST_USER.organizationId, name: 'Campaign' },
    ]);

    const response = await PUT(new NextRequest('http://localhost/api/social-media/campaigns?id=camp-1', {
      method: 'PUT',
      body: JSON.stringify({
        start_date: '2026-08-01T00:00:00.000Z',
        end_date: '2026-07-01T00:00:00.000Z',
      }),
      headers: { 'content-type': 'application/json' },
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('updates a campaign when caller is authorized', async () => {
    const { PUT } = await loadRoute();
    m.queueSelect([
      { id: 'camp-1', organizationId: TEST_USER.organizationId, name: 'Campaign' },
    ]);
    m.queueUpdate([
      { id: 'camp-1', organizationId: TEST_USER.organizationId, name: 'Updated Campaign' },
    ]);

    const response = await PUT(new NextRequest('http://localhost/api/social-media/campaigns?id=camp-1', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Updated Campaign' }),
      headers: { 'content-type': 'application/json' },
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.campaign).toMatchObject({ id: 'camp-1', name: 'Updated Campaign' });
  });

  it('prevents deleting campaigns that still have posts', async () => {
    const { DELETE } = await loadRoute();
    m.queueSelect(
      [{ id: 'camp-1', organizationId: TEST_USER.organizationId }],
      [{ id: 'post-1' }],
    );

    const response = await DELETE(new NextRequest('http://localhost/api/social-media/campaigns?id=camp-1', {
      method: 'DELETE',
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Cannot delete campaign with associated posts',
    });
  });

  it('deletes campaigns without associated posts', async () => {
    const { DELETE } = await loadRoute();
    m.queueSelect(
      [{ id: 'camp-1', organizationId: TEST_USER.organizationId }],
      [],
    );
    m.queueDelete([]);

    const response = await DELETE(new NextRequest('http://localhost/api/social-media/campaigns?id=camp-1', {
      method: 'DELETE',
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ message: 'Campaign deleted successfully', campaign_id: 'camp-1' });
  });
});
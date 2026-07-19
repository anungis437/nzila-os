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
  };

  const nextSelect = () => Promise.resolve((state.selectQueue.shift() ?? []) as unknown[]);

  const createSelectChain = () => {
    const chain = {
      from: vi.fn(() => chain),
      leftJoin: vi.fn(() => chain),
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
    queueSelect: (...results: unknown[][]) => state.selectQueue.push(...results),
    resetQueues: () => {
      state.selectQueue = [];
    },
    createSelectChain,
  };
});

const mockDb = {
  select: vi.fn(() => m.createSelectChain()),
};

vi.mock('@/db', () => ({ db: mockDb }));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  RATE_LIMITS: {
    SOCIAL_MEDIA_API: { requests: 30, window: 60 },
  },
}));
vi.mock('@/lib/api-auth-guard', () => ({
  withRoleAuth: vi.fn(
    (_role: string, handler: (req: NextRequest, ctx: typeof TEST_USER) => Promise<Response>) =>
      (req: NextRequest, ctx: Partial<typeof TEST_USER> = {}) => handler(req, { ...TEST_USER, ...ctx })
  ),
}));

async function loadRoute() {
  return import('../social-media/analytics/route');
}

describe('social-media/analytics route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.resetQueues();
    m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 0, remaining: 99 });
  });

  it('returns forbidden when organization context is missing', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/social-media/analytics'), {
      ...TEST_USER,
      organizationId: '',
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'FORBIDDEN' });
  }, 60000);

  it('returns rate-limit response when GET throttles', async () => {
    const { GET } = await loadRoute();
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false, resetIn: 25 });
    const response = await GET(new NextRequest('http://localhost/api/social-media/analytics'));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({ code: 'RATE_LIMIT_EXCEEDED' });
  });

  it('returns grouped account analytics summary on GET success', async () => {
    const { GET } = await loadRoute();
    m.queueSelect([
      {
        id: 'an-1',
        accountId: 'acct-1',
        analyticsDate: '2026-05-01',
        totalImpressions: 100,
        totalReach: 80,
        totalLikes: 10,
        totalComments: 5,
        totalShares: 3,
        totalEngagements: 18,
        linkClicks: 4,
        engagementRate: '0.18',
        accountPlatform: 'facebook',
        accountUsername: 'union-eyes',
        accountDisplayName: 'Union Eyes',
        accountProfileImageUrl: null,
      },
      {
        id: 'an-2',
        accountId: 'acct-1',
        analyticsDate: '2026-05-02',
        totalImpressions: 200,
        totalReach: 160,
        totalLikes: 20,
        totalComments: 10,
        totalShares: 6,
        totalEngagements: 36,
        linkClicks: 8,
        engagementRate: '0.18',
        accountPlatform: 'facebook',
        accountUsername: 'union-eyes',
        accountDisplayName: 'Union Eyes',
        accountProfileImageUrl: null,
      },
    ]);

    const response = await GET(new NextRequest('http://localhost/api/social-media/analytics?platform=facebook'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.accounts).toHaveLength(1);
    expect(payload.accounts[0].summary).toMatchObject({
      total_impressions: 300,
      total_engagement: 54,
      avg_engagement_rate: 0.18,
    });
  });

  it('rejects POST with invalid payload', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/social-media/analytics', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ campaign_id: 'bad-uuid' }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('returns post analytics summary on POST success', async () => {
    const { POST } = await loadRoute();
    m.queueSelect(
      [{ total: 2 }],
      [
        {
          id: 'post-1',
          content: 'Post 1',
          mediaUrls: [],
          publishedAt: new Date('2026-05-01T00:00:00.000Z'),
          impressionsCount: 100,
          reachCount: 80,
          likesCount: 12,
          commentsCount: 3,
          sharesCount: 2,
          engagementRate: '0.17',
          accountPlatform: 'facebook',
          accountUsername: 'union-eyes',
        },
        {
          id: 'post-2',
          content: 'Post 2',
          mediaUrls: [],
          publishedAt: new Date('2026-05-02T00:00:00.000Z'),
          impressionsCount: 200,
          reachCount: 160,
          likesCount: 18,
          commentsCount: 7,
          sharesCount: 5,
          engagementRate: '0.15',
          accountPlatform: 'facebook',
          accountUsername: 'union-eyes',
        },
      ],
    );

    const response = await POST(new NextRequest('http://localhost/api/social-media/analytics', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ campaign_id: '00000000-0000-0000-0000-000000000010', limit: 10, offset: 0 }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.total).toBe(2);
    expect(payload.summary).toMatchObject({ total_posts: 2, total_impressions: 300, total_engagement: 47 });
    expect(payload.top_posts).toHaveLength(2);
  });

  it('returns missing field when PUT campaign id is absent', async () => {
    const { PUT } = await loadRoute();
    const response = await PUT(new NextRequest('http://localhost/api/social-media/analytics', { method: 'PUT' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'MISSING_REQUIRED_FIELD' });
  });

  it('returns not found for missing campaign on PUT', async () => {
    const { PUT } = await loadRoute();
    m.queueSelect([]);

    const response = await PUT(new NextRequest('http://localhost/api/social-media/analytics?id=camp-1', { method: 'PUT' }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  });

  it('returns campaign analytics payload on PUT success', async () => {
    const { PUT } = await loadRoute();
    m.queueSelect(
      [{ id: 'camp-1', organizationId: TEST_USER.organizationId, name: 'Campaign', description: '', startDate: '2026-05-01', endDate: '2026-05-31', status: 'active' }],
      [
        {
          id: 'post-1',
          content: 'A',
          publishedAt: new Date('2026-05-01T00:00:00.000Z'),
          impressionsCount: 100,
          reachCount: 90,
          likesCount: 10,
          commentsCount: 2,
          sharesCount: 1,
          engagementRate: '0.13',
          accountPlatform: 'facebook',
        },
      ],
    );

    const response = await PUT(new NextRequest('http://localhost/api/social-media/analytics?id=camp-1', { method: 'PUT' }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.campaign).toMatchObject({ id: 'camp-1' });
    expect(payload.metrics).toMatchObject({ total_posts: 1, total_impressions: 100 });
    expect(payload.platform_metrics).toHaveLength(1);
  });

  it('returns validation error for unsupported DELETE data type', async () => {
    const { DELETE } = await loadRoute();
    const response = await DELETE(new NextRequest('http://localhost/api/social-media/analytics?type=invalid', { method: 'DELETE' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('returns json export payload for DELETE format=json', async () => {
    const { DELETE } = await loadRoute();
    m.queueSelect([
      {
        date: '2026-05-01',
        platform: 'facebook',
        account: 'union-eyes',
        impressions: 100,
      },
    ]);

    const response = await DELETE(new NextRequest('http://localhost/api/social-media/analytics?type=accounts&format=json', { method: 'DELETE' }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toHaveLength(1);
    expect(payload.headers).toContain('Date');
  });
});
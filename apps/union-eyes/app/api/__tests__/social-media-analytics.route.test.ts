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
      innerJoin: vi.fn(() => chain),
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
    auditSocialAnalyticsExport: vi.fn(),
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
vi.mock('@/lib/social-media/export-audit', () => ({ auditSocialAnalyticsExport: m.auditSocialAnalyticsExport }));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  RATE_LIMITS: {
    SOCIAL_MEDIA_API: { requests: 30, window: 60 },
  },
}));
vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule);

const { caller, declared, resetCaller } = await import('./support/with-api-stub');

const CAMPAIGN_ID = '00000000-0000-0000-0000-000000000011';

async function loadRoute() {
  return import('../social-media/analytics/route');
}

describe('social-media/analytics route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.resetQueues();
    resetCaller();
    caller.userId = TEST_USER.userId;
    caller.organizationId = TEST_USER.organizationId;
    caller.role = TEST_USER.role;
    m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 0, remaining: 99 });
    m.auditSocialAnalyticsExport.mockResolvedValue(undefined);
  });

  it('declares what it asks of the wrapper: a member for the reads, in the organization\'s tenant transaction, and a steward for the export and the refused DELETE', async () => {
    await loadRoute();
    const summary = (text: string) => declared.find((entry) => entry.openapi?.summary === text);

    for (const text of [
      'Social media analytics of the organization (steward-only with export=true)',
      'Performance of the published posts of a campaign',
      'Figures and timeline of a campaign',
    ]) {
      expect(summary(text)?.auth, text).toEqual({ minRole: 'member' });
      expect(summary(text)?.rlsOrgContext, text).toBe(true);
    }
    expect(summary('Export the social media analytics of the organization')?.auth).toEqual({ minRole: 'steward' });
    expect(summary('Export the social media analytics of the organization')?.rlsOrgContext).toBe(true);
    expect(summary('Refused: use GET with export=true')?.auth).toEqual({ minRole: 'steward' });
  });

  it('returns forbidden when organization context is missing', async () => {
    caller.organizationId = null;
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/social-media/analytics'));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'INSUFFICIENT_PERMISSIONS' });
    expect(m.checkRateLimit).not.toHaveBeenCalled();
    expect(mockDb.select).not.toHaveBeenCalled();
  }, 60000);

  it('returns rate-limit response when GET throttles', async () => {
    const { GET } = await loadRoute();
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false, resetIn: 25 });
    const response = await GET(new NextRequest('http://localhost/api/social-media/analytics'));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({ code: 'RATE_LIMIT_EXCEEDED' });
  });

  // DEF-0B11-SOC-ANALYTICS-AND-ENGAGEMENT-FIGURES-HAVE-NO-WRITER-SO-EVERY-METRIC-IS-ZERO-OR-EMPTY
  it('says that nothing has been collected, rather than reading an empty range as no activity', async () => {
    const { GET } = await loadRoute();
    m.queueSelect([], []);
    const response = await GET(new NextRequest('http://localhost/api/social-media/analytics'));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ accounts: [], data_collected: false });
    expect(body.message).toContain('have not been collected');
  });

  it('distinguishes an empty range from an organization whose analytics were collected earlier', async () => {
    const { GET } = await loadRoute();
    m.queueSelect([], [{ id: 'earlier-row' }]);
    const body = await (await GET(new NextRequest('http://localhost/api/social-media/analytics'))).json();
    expect(body).toMatchObject({ accounts: [], data_collected: true });
    expect(body).not.toHaveProperty('message');
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
    expect(payload.summary.total_clicks).toBeNull(); // no clicks are measured for posts
    expect(payload.top_posts).toHaveLength(2);
  });

  it('returns missing field when PUT campaign id is absent', async () => {
    const { PUT } = await loadRoute();
    const response = await PUT(new NextRequest('http://localhost/api/social-media/analytics', { method: 'PUT' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'MISSING_REQUIRED_FIELD' });
  });

  it('answers 400, and reads nothing, for a campaign id that is not a valid id', async () => {
    const { PUT } = await loadRoute();
    const response = await PUT(new NextRequest('http://localhost/api/social-media/analytics?id=camp-1', { method: 'PUT' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('returns not found for missing campaign on PUT', async () => {
    const { PUT } = await loadRoute();
    m.queueSelect([]);

    const response = await PUT(new NextRequest(`http://localhost/api/social-media/analytics?id=${CAMPAIGN_ID}`, { method: 'PUT' }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  });

  it('returns campaign analytics payload on PUT success', async () => {
    const { PUT } = await loadRoute();
    m.queueSelect(
      [{ id: CAMPAIGN_ID, organizationId: TEST_USER.organizationId, name: 'Campaign', description: '', startDate: '2026-05-01', endDate: '2026-05-31', status: 'active' }],
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

    const response = await PUT(new NextRequest(`http://localhost/api/social-media/analytics?id=${CAMPAIGN_ID}`, { method: 'PUT' }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.campaign).toMatchObject({ id: CAMPAIGN_ID });
    expect(payload.metrics).toMatchObject({ total_posts: 1, total_impressions: 100 });
    expect(payload.metrics.total_clicks).toBeNull(); // no campaign click collector
    expect(payload.platform_metrics).toHaveLength(1);
  });

  it('refuses the misleading DELETE export verb without reading or auditing data', async () => {
    caller.role = 'steward';
    const { DELETE } = await loadRoute();
    const response = await DELETE(new NextRequest('http://localhost/api/social-media/analytics?type=accounts', { method: 'DELETE' }));
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET');
    expect(mockDb.select).not.toHaveBeenCalled();
    expect(m.auditSocialAnalyticsExport).not.toHaveBeenCalled();
  });

  it('refuses a member the DELETE verb with a 403, not the 405 a steward is told', async () => {
    const { DELETE } = await loadRoute();
    const response = await DELETE(new NextRequest('http://localhost/api/social-media/analytics?type=accounts', { method: 'DELETE' }));

    expect(response.status).toBe(403);
    expect(mockDb.select).not.toHaveBeenCalled();
    expect(m.auditSocialAnalyticsExport).not.toHaveBeenCalled();
  });

  it('refuses a member the export before the rate limit, any read or the audit, and still lets a member read the analytics', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/social-media/analytics?export=true&type=accounts&format=json'));

    expect(response.status).toBe(403);
    expect(m.checkRateLimit).not.toHaveBeenCalledWith('social-analytics-export:' + TEST_USER.userId, expect.anything());
    expect(mockDb.select).not.toHaveBeenCalled();
    expect(m.auditSocialAnalyticsExport).not.toHaveBeenCalled();

    m.queueSelect([], []);
    expect((await GET(new NextRequest('http://localhost/api/social-media/analytics'))).status).toBe(200);
  });

  it('validates export parameters before querying or auditing', async () => {
    caller.role = 'steward';
    const { GET } = await loadRoute();
    for (const query of [
      'type=invalid&format=json', 'type=accounts&format=xml',
      'type=accounts&start_date=2026-02-30', 'type=accounts&start_date=2025-01-01&end_date=2026-10-01',
    ]) {
      const response = await GET(new NextRequest('http://localhost/api/social-media/analytics?export=true&' + query));
      expect(response.status).toBe(400);
    }
    expect(mockDb.select).not.toHaveBeenCalled();
    expect(m.auditSocialAnalyticsExport).not.toHaveBeenCalled();
  });

  it('exports account analytics over GET only after mandatory audit, with no-store', async () => {
    caller.role = 'steward';
    const { GET } = await loadRoute();
    m.queueSelect([{ date: '2026-05-01', platform: 'facebook', account: 'union-eyes', impressions: 100 }]);
    const response = await GET(new NextRequest('http://localhost/api/social-media/analytics?export=true&type=accounts&format=json'));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(payload.data).toHaveLength(1);
    expect(payload.headers).toContain('Date');
    expect(m.auditSocialAnalyticsExport).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: TEST_USER.organizationId, userId: TEST_USER.userId,
      dataType: 'accounts', format: 'json', rowCount: 1,
    }));
  });

  it('does not fabricate zero clicks for a campaign with no click collector', async () => {
    caller.role = 'steward';
    const { GET } = await loadRoute();
    m.queueSelect([
      { id: 'campaign-1', name: 'Campaign', platforms: [], startDate: '2026-05-01', endDate: '2026-05-31', status: 'active' },
    ], []);
    const response = await GET(new NextRequest('http://localhost/api/social-media/analytics?export=true&type=campaigns&format=json'));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data[0].total_clicks).toBeNull();
  });

  it('fails closed if mandatory export audit cannot be persisted', async () => {
    caller.role = 'steward';
    const { GET } = await loadRoute();
    m.queueSelect([{ date: '2026-05-01' }]);
    m.auditSocialAnalyticsExport.mockRejectedValueOnce(new Error('audit unavailable'));
    const response = await GET(new NextRequest('http://localhost/api/social-media/analytics?export=true&type=accounts&format=json'));
    expect(response.status).toBe(503);
    expect((await response.json()).data).toBeUndefined();
  });

  it('does not silently truncate exports exceeding the safe row bound', async () => {
    caller.role = 'steward';
    const { GET } = await loadRoute();
    m.queueSelect(Array.from({ length: 5001 }, (_, i) => ({ date: '2026-05-01', impressions: i })));
    const response = await GET(new NextRequest('http://localhost/api/social-media/analytics?export=true&type=accounts&format=json'));
    expect(response.status).toBe(409);
    expect(m.auditSocialAnalyticsExport).not.toHaveBeenCalled();
  });
});
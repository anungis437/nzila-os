import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const TEST_USER = {
  userId: 'user_test_001',
  organizationId: '00000000-0000-0000-0000-000000000001',
  // Creating, changing and deleting a campaign take a steward; a member only reads.
  role: 'steward',
};

const CAMPAIGN_ID = '00000000-0000-0000-0000-0000000000c1';
const OTHER_CAMPAIGN_ID = '00000000-0000-0000-0000-0000000000c2';

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
    persistAtomicAudit: vi.fn(),
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
    where: vi.fn(() => {
      const rows = m.nextDelete();
      return Object.assign(rows, { returning: () => rows.then((r) => (r.length ? r : [{ id: CAMPAIGN_ID }])) });
    }),
  })),
};

vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule);
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));

// The ambient `db` is the request's tenant transaction (the routes declare `rlsOrgContext`).
vi.mock('@/db', () => ({ db: mockDb }));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  RATE_LIMITS: {
    CAMPAIGN_OPERATIONS: { requests: 30, window: 60 },
  },
}));

const { caller, declared, resetCaller } = await import('./support/with-api-stub');

async function loadRoute() {
  return import('../social-media/campaigns/route');
}

describe('social-media/campaigns route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.resetQueues();
    resetCaller();
    caller.userId = TEST_USER.userId;
    caller.organizationId = TEST_USER.organizationId;
    caller.role = TEST_USER.role;
    m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 0, remaining: 99 });
    m.persistAtomicAudit.mockResolvedValue(undefined);
  });

  it('declares what it asks of the wrapper: a member to read and a steward to write, every one in the organization\'s tenant transaction', async () => {
    await loadRoute();
    const summary = (text: string) => declared.find((entry) => entry.openapi?.summary === text);

    expect(summary('List the social media campaigns of the organization with their figures')?.auth).toEqual({ minRole: 'member' });
    for (const text of [
      'List the social media campaigns of the organization with their figures',
      'Create a social media campaign',
      'Update a social media campaign',
      'Delete a social media campaign that has no posts',
    ]) {
      expect(summary(text)?.rlsOrgContext, text).toBe(true);
    }
    for (const text of ['Create a social media campaign', 'Update a social media campaign', 'Delete a social media campaign that has no posts']) {
      expect(summary(text)?.auth, text).toEqual({ minRole: 'steward' });
    }
  });

  it('refuses a member every write before anything is read, written or audited, and lets a member read', async () => {
    caller.role = 'member';
    const { GET, POST, PUT, DELETE } = await loadRoute();
    const headers = { 'content-type': 'application/json' };

    expect((await POST(new NextRequest('http://localhost/api/social-media/campaigns', {
      method: 'POST', body: JSON.stringify({ name: 'Campaign', platforms: ['facebook'] }), headers,
    }))).status).toBe(403);
    expect((await PUT(new NextRequest(`http://localhost/api/social-media/campaigns?id=${CAMPAIGN_ID}`, {
      method: 'PUT', body: JSON.stringify({ name: 'Renamed' }), headers,
    }))).status).toBe(403);
    expect((await DELETE(new NextRequest(`http://localhost/api/social-media/campaigns?id=${CAMPAIGN_ID}`, { method: 'DELETE' }))).status).toBe(403);
    expect(mockDb.select).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(mockDb.delete).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();

    m.queueSelect([{ total: 0 }], []);
    expect((await GET(new NextRequest('http://localhost/api/social-media/campaigns'))).status).toBe(200);
  });

  it('refuses a caller who is not signed in', async () => {
    caller.userId = null;
    const { GET } = await loadRoute();

    expect((await GET(new NextRequest('http://localhost/api/social-media/campaigns'))).status).toBe(401);
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('returns forbidden when organization context is missing', async () => {
    caller.organizationId = null;
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/social-media/campaigns'));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'INSUFFICIENT_PERMISSIONS' });
    expect(m.checkRateLimit).not.toHaveBeenCalled();
    expect(mockDb.select).not.toHaveBeenCalled();
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
        id: CAMPAIGN_ID,
        organizationId: TEST_USER.organizationId,
        name: 'Organizing Drive',
        description: 'Summer organizing outreach',
        status: 'active',
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
      }],
      // The posts of the whole page come back in one statement, each naming its campaign.
      [{ campaignId: CAMPAIGN_ID, impressionsCount: 200, likesCount: 20, commentsCount: 5, sharesCount: 3 }],
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
        id: CAMPAIGN_ID,
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
    expect(payload.data.campaign).toMatchObject({ id: CAMPAIGN_ID, name: 'Summer Mobilization' });
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({ action: 'social.campaign.create', resourceId: CAMPAIGN_ID, userId: TEST_USER.userId }),
    );
  });

  it('persists typed campaign goals and requested status rather than silently discarding them', async () => {
    const { POST } = await loadRoute();
    m.queueInsert([{ id: 'camp-goals', organizationId: TEST_USER.organizationId }]);
    const response = await POST(new NextRequest('http://localhost/api/social-media/campaigns', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Evidence-backed campaign', platforms: ['facebook'], status: 'planning',
        goals: [
          { metric: 'impressions', target_value: 1200 },
          { metric: 'engagement_rate', target_value: 4.5 },
          { metric: 'conversions', target_value: 80 },
        ],
      }),
      headers: { 'content-type': 'application/json' },
    }));
    expect(response.status).toBe(200);
    expect(mockDb.insert).toHaveBeenCalled();
    const values = (mockDb.insert.mock.results.at(-1)?.value as any).values;
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      status: 'planning', goalImpressions: 1200, goalEngagementRate: '4.50', goalConversions: 80,
    }));
  });

  it.each([
    { goals: [{ metric: 'made_up', target_value: 10 }] },
    { goals: [{ metric: 'impressions', target_value: -1 }] },
    { goals: [{ metric: 'impressions', target_value: 10.5 }] },
    { goals: [{ metric: 'impressions', target_value: 10 }, { metric: 'impressions', target_value: 20 }] },
    { status: 'published' },
    { arbitraryApproval: true },
  ])('refuses unsupported campaign creation fields and goals: %j', async (extra) => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/social-media/campaigns', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', platforms: ['facebook'], ...extra }),
      headers: { 'content-type': 'application/json' },
    }));
    expect(response.status).toBe(400);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('does not create a campaign when its audit cannot be written', async () => {
    const { POST } = await loadRoute();
    m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit unavailable'));

    const response = await POST(new NextRequest('http://localhost/api/social-media/campaigns', {
      method: 'POST',
      body: JSON.stringify({ name: 'Summer Mobilization', platforms: ['facebook'] }),
      headers: { 'content-type': 'application/json' },
    }));

    expect(response.status).toBe(500);
  });

  it('answers 404 for another organization\u2019s campaign without updating or auditing', async () => {
    const { PUT } = await loadRoute();
    m.queueSelect([]);

    const response = await PUT(new NextRequest(`http://localhost/api/social-media/campaigns?id=${OTHER_CAMPAIGN_ID}`, {
      method: 'PUT',
      body: JSON.stringify({ name: 'Hijacked' }),
      headers: { 'content-type': 'application/json' },
    }));

    expect(response.status).toBe(404);
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('answers 400, and reads nothing, for a campaign id that is not a valid id', async () => {
    const { PUT, DELETE } = await loadRoute();

    const put = await PUT(new NextRequest('http://localhost/api/social-media/campaigns?id=camp-1', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Renamed' }),
      headers: { 'content-type': 'application/json' },
    }));
    const del = await DELETE(new NextRequest('http://localhost/api/social-media/campaigns?id=camp-1', { method: 'DELETE' }));

    expect(put.status).toBe(400);
    expect(del.status).toBe(400);
    expect(mockDb.select).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(mockDb.delete).not.toHaveBeenCalled();
  });

  it('returns validation error when campaign start date is after end date', async () => {
    const { PUT } = await loadRoute();
    m.queueSelect([
      { id: CAMPAIGN_ID, organizationId: TEST_USER.organizationId, name: 'Campaign' },
    ]);

    const response = await PUT(new NextRequest(`http://localhost/api/social-media/campaigns?id=${CAMPAIGN_ID}`, {
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

  it.each([
    { status: 'published' },
    { platforms: ['unapproved-network'] },
    { name: 123 },
    { goals: [{ metric: 'conversions', target_value: 'lots' }] },
    { organizationId: 'foreign-org' },
    { completedBy: 'caller-supplied' },
  ])('rejects invalid or privileged campaign updates: %j', async (payload) => {
    const { PUT } = await loadRoute();
    m.queueSelect([{ id: CAMPAIGN_ID, organizationId: TEST_USER.organizationId }]);
    const response = await PUT(new NextRequest(`http://localhost/api/social-media/campaigns?id=${CAMPAIGN_ID}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
      headers: { 'content-type': 'application/json' },
    }));
    expect(response.status).toBe(400);
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('updates a campaign when caller is authorized', async () => {
    const { PUT } = await loadRoute();
    m.queueSelect([
      { id: CAMPAIGN_ID, organizationId: TEST_USER.organizationId, name: 'Campaign' },
    ]);
    m.queueUpdate([
      { id: CAMPAIGN_ID, organizationId: TEST_USER.organizationId, name: 'Updated Campaign' },
    ]);

    const response = await PUT(new NextRequest(`http://localhost/api/social-media/campaigns?id=${CAMPAIGN_ID}`, {
      method: 'PUT',
      body: JSON.stringify({ name: 'Updated Campaign' }),
      headers: { 'content-type': 'application/json' },
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.campaign).toMatchObject({ id: CAMPAIGN_ID, name: 'Updated Campaign' });
  });

  it('prevents deleting campaigns that still have posts', async () => {
    const { DELETE } = await loadRoute();
    m.queueSelect(
      [{ id: CAMPAIGN_ID, organizationId: TEST_USER.organizationId }],
      [{ id: 'post-1' }],
    );

    const response = await DELETE(new NextRequest(`http://localhost/api/social-media/campaigns?id=${CAMPAIGN_ID}`, {
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
      [{ id: CAMPAIGN_ID, organizationId: TEST_USER.organizationId }],
      [],
    );
    m.queueDelete([]);

    const response = await DELETE(new NextRequest(`http://localhost/api/social-media/campaigns?id=${CAMPAIGN_ID}`, {
      method: 'DELETE',
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ message: 'Campaign deleted successfully', campaign_id: CAMPAIGN_ID });
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({ action: 'social.campaign.delete', resourceId: CAMPAIGN_ID }),
    );
  });
});
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const TEST_USER = {
  userId: 'user_test_001',
  organizationId: '00000000-0000-0000-0000-000000000001',
  role: 'steward',
};

const m = vi.hoisted(() => {
  const cookieStore = {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  };

  const state = {
    selectQueue: [] as unknown[][],
    updateWhereQueue: [] as unknown[][],
    deleteWhereQueue: [] as unknown[][],
  };

  const nextSelect = () => Promise.resolve((state.selectQueue.shift() ?? []) as unknown[]);
  const nextUpdateWhere = () => Promise.resolve((state.updateWhereQueue.shift() ?? []) as unknown[]);
  const nextDeleteWhere = () => Promise.resolve((state.deleteWhereQueue.shift() ?? []) as unknown[]);

  const createSelectChain = () => {
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      then: (resolve: (value: unknown[]) => unknown) => nextSelect().then(resolve),
    };
    return chain;
  };

  const createUpdateChain = () => ({
    set: vi.fn(() => ({
      where: vi.fn(() => nextUpdateWhere()),
    })),
  });

  return {
    state,
    cookieStore,
    checkRateLimit: vi.fn(),
    logApiAuditEvent: vi.fn(),
    createMetaClient: vi.fn(),
    createTwitterClient: vi.fn(),
    createLinkedInClient: vi.fn(),
    generatePKCE: vi.fn(),
    cookies: vi.fn(async () => cookieStore),
    withRLSContext: vi.fn(async (fn: (db: unknown) => Promise<unknown>) => fn(mockDb)),
    queueSelect: (...results: unknown[][]) => state.selectQueue.push(...results),
    queueUpdateWhere: (...results: unknown[][]) => state.updateWhereQueue.push(...results),
    queueDeleteWhere: (...results: unknown[][]) => state.deleteWhereQueue.push(...results),
    resetQueues: () => {
      state.selectQueue = [];
      state.updateWhereQueue = [];
      state.deleteWhereQueue = [];
    },
    createSelectChain,
    createUpdateChain,
    nextDeleteWhere,
  };
});

const mockDb = {
  select: vi.fn(() => m.createSelectChain()),
  update: vi.fn(() => m.createUpdateChain()),
  delete: vi.fn(() => ({
    where: vi.fn(() => m.nextDeleteWhere()),
  })),
};

vi.mock('@/lib/middleware/api-security', () => ({
  logApiAuditEvent: m.logApiAuditEvent,
}));

vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  RATE_LIMITS: {
    SOCIAL_MEDIA_API: { requests: 30, window: 60 },
  },
}));

vi.mock('@/lib/social-media/meta-api-client', () => ({
  createMetaClient: m.createMetaClient,
}));

vi.mock('@/lib/social-media/twitter-api-client', () => ({
  createTwitterClient: m.createTwitterClient,
  generatePKCE: m.generatePKCE,
}));

vi.mock('@/lib/social-media/linkedin-api-client', () => ({
  createLinkedInClient: m.createLinkedInClient,
}));

vi.mock('next/headers', () => ({
  cookies: m.cookies,
}));

vi.mock('@/db', () => ({ db: mockDb }));

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: m.withRLSContext,
}));

vi.mock('@/lib/api-auth-guard', async (orig) => {
  const actual = await orig<typeof import('@/lib/api-auth-guard')>();
  return {
    ...actual,
    withRoleAuth: vi.fn(
      (_role: string, handler: (req: NextRequest, ctx: typeof TEST_USER) => Promise<Response>) =>
        (req: NextRequest, ctx: Partial<typeof TEST_USER> = {}) =>
          handler(req, { ...TEST_USER, ...ctx })
    ),
  };
});

async function loadRoute() {
  const mod = await import('../social-media/accounts/route');
  return mod;
}

describe('social-media/accounts route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.resetQueues();
    m.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 99, resetIn: 0 });
    m.createMetaClient.mockReturnValue({
      getAuthorizationUrl: vi.fn(() => 'https://meta.example/authorize'),
      getLongLivedToken: vi.fn(async () => ({ access_token: 'meta-access', expires_in: 3600 })),
    });
    m.createTwitterClient.mockReturnValue({
      getAuthorizationUrl: vi.fn(() => 'https://twitter.example/authorize'),
      revokeToken: vi.fn(async () => undefined),
      refreshAccessToken: vi.fn(async () => ({ access_token: 'twitter-access', refresh_token: 'twitter-refresh', expires_in: 7200 })),
    });
    m.createLinkedInClient.mockReturnValue({
      getAuthorizationUrl: vi.fn(() => 'https://linkedin.example/authorize'),
      refreshAccessToken: vi.fn(async () => ({ access_token: 'linkedin-access', refresh_token: 'linkedin-refresh', expires_in: 1800 })),
    });
    m.generatePKCE.mockReturnValue({ verifier: 'verifier-123', challenge: 'challenge-123' });
  });

  it('returns forbidden when GET has no organization context', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/social-media/accounts'), {
      ...TEST_USER,
      organizationId: '',
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'FORBIDDEN' });
  }, 60000);

  it('returns rate limit details on GET throttling', async () => {
    const { GET } = await loadRoute();
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false, resetIn: 42 });

    const response = await GET(new NextRequest('http://localhost/api/social-media/accounts'));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({ code: 'RATE_LIMIT_EXCEEDED' });
  });

  it('lists accounts and writes an audit event on GET success', async () => {
    const { GET } = await loadRoute();
    m.queueSelect([
      {
        id: 'acct-1',
        platform: 'facebook',
        platformUserId: 'fb-1',
        username: 'union-eyes',
        displayName: 'Union Eyes',
        profileImageUrl: null,
        followerCount: 42,
        engagementRate: '0.15',
        status: 'active',
        connectedAt: new Date('2026-01-01T00:00:00.000Z'),
        lastSyncedAt: null,
        rateLimitRemaining: 10,
        rateLimitResetAt: null,
      },
    ]);

    const response = await GET(new NextRequest('http://localhost/api/social-media/accounts'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.accounts).toHaveLength(1);
    expect(payload.accounts[0]).toMatchObject({ id: 'acct-1', platform: 'facebook' });
    expect(m.logApiAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'LIST_SOCIAL_ACCOUNTS',
      metadata: { count: 1 },
    }));
  });

  it('starts a facebook OAuth flow and stores state in cookies', async () => {
    const { POST } = await loadRoute();
    const request = new NextRequest('http://localhost/api/social-media/accounts', {
      method: 'POST',
      body: JSON.stringify({ platform: 'facebook', account_id: '00000000-0000-0000-0000-000000000002' }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.auth_url).toBe('https://meta.example/authorize');
    expect(m.cookieStore.set).toHaveBeenCalledWith(
      'oauth_state',
      expect.stringContaining('user_test_001:facebook:'),
      expect.objectContaining({ httpOnly: true, maxAge: 600 }),
    );
  });

  it('stores PKCE verifier for twitter OAuth', async () => {
    const { POST } = await loadRoute();
    const request = new NextRequest('http://localhost/api/social-media/accounts', {
      method: 'POST',
      body: JSON.stringify({ platform: 'twitter', account_id: '00000000-0000-0000-0000-000000000002' }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.auth_url).toBe('https://twitter.example/authorize');
    expect(m.cookieStore.set).toHaveBeenCalledWith(
      'twitter_code_verifier',
      'verifier-123',
      expect.objectContaining({ httpOnly: true, maxAge: 600 }),
    );
  });

  it('rejects unsupported OAuth platforms', async () => {
    const { POST } = await loadRoute();
    const request = new NextRequest('http://localhost/api/social-media/accounts', {
      method: 'POST',
      body: JSON.stringify({ platform: 'mastodon', account_id: '00000000-0000-0000-0000-000000000002' }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('requires an account id on DELETE', async () => {
    const { DELETE } = await loadRoute();
    const response = await DELETE(new NextRequest('http://localhost/api/social-media/accounts', { method: 'DELETE' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'MISSING_REQUIRED_FIELD' });
  });

  it('forbids deleting an account from another organization', async () => {
    const { DELETE } = await loadRoute();
    m.queueSelect([
      {
        id: 'acct-1',
        organizationId: '00000000-0000-0000-0000-000000000999',
        platform: 'twitter',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      },
    ]);

    const response = await DELETE(new NextRequest('http://localhost/api/social-media/accounts?id=acct-1', { method: 'DELETE' }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('revokes twitter credentials and deletes the account', async () => {
    const { DELETE } = await loadRoute();
    const revokeToken = vi.fn(async () => undefined);
    m.createTwitterClient.mockReturnValueOnce({ revokeToken });
    m.queueSelect([
      {
        id: 'acct-1',
        organizationId: TEST_USER.organizationId,
        platform: 'twitter',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      },
    ]);
    m.queueDeleteWhere([]);

    const response = await DELETE(new NextRequest('http://localhost/api/social-media/accounts?id=acct-1', { method: 'DELETE' }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ account_id: 'acct-1' });
    expect(revokeToken).toHaveBeenCalled();
    expect(m.logApiAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'DISCONNECT_SOCIAL_ACCOUNT' }));
  });

  it('returns not found when refreshing a missing account', async () => {
    const { PUT } = await loadRoute();
    m.queueSelect([]);

    const response = await PUT(new NextRequest('http://localhost/api/social-media/accounts', {
      method: 'PUT',
      body: JSON.stringify({ account_id: 'acct-1' }),
      headers: { 'content-type': 'application/json' },
    }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  });

  it('expires a twitter account when no refresh token is available', async () => {
    const { PUT } = await loadRoute();
    m.queueSelect([
      {
        id: 'acct-1',
        organizationId: TEST_USER.organizationId,
        platform: 'twitter',
        accessToken: 'access-token',
        refreshToken: null,
      },
    ]);
    m.queueUpdateWhere([]);

    const response = await PUT(new NextRequest('http://localhost/api/social-media/accounts', {
      method: 'PUT',
      body: JSON.stringify({ account_id: 'acct-1' }),
      headers: { 'content-type': 'application/json' },
    }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: 'Failed to refresh token' });
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('refreshes a facebook token and returns the new expiry', async () => {
    const { PUT } = await loadRoute();
    m.queueSelect([
      {
        id: 'acct-1',
        organizationId: TEST_USER.organizationId,
        platform: 'facebook',
        accessToken: 'old-meta-token',
        refreshToken: null,
      },
    ]);
    m.queueUpdateWhere([]);

    const response = await PUT(new NextRequest('http://localhost/api/social-media/accounts', {
      method: 'PUT',
      body: JSON.stringify({ account_id: 'acct-1' }),
      headers: { 'content-type': 'application/json' },
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.message).toBe('Token refreshed successfully');
    expect(payload.expires_at).toEqual(expect.any(String));
  });
});
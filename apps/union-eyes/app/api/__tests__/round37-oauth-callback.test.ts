/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 round 37: social_accounts OAuth credential authority — callback.
 *
 * Proves the repaired OAuth callback (app/api/social-media/accounts/
 * callback/route.ts) enforces the required negative properties: state
 * mismatch/replay/missing rejected, the flow is bound to the authenticated
 * session, PKCE is required and consumed for Twitter, organizationId for
 * the resulting INSERT comes only from the authenticated server context
 * (never from query params/state/provider payload), no credential material
 * is ever returned to the caller, and all temporary OAuth cookies are
 * cleared on both success and failure paths.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const ORG_B = 'org-B-uuid';
const USER_B = 'user-b-1';
const TEST_USER = { userId: USER_B, organizationId: ORG_B, role: 'steward' };

const m = vi.hoisted(() => ({
  logApiAuditEvent: vi.fn(),
  createMetaClient: vi.fn(),
  createTwitterClient: vi.fn(),
  createLinkedInClient: vi.fn(),
  withRLSContextCalls: [] as unknown[],
  insertedValues: [] as unknown[],
  cookieStore: {
    values: {} as Record<string, string>,
    get(name: string) {
      return name in this.values ? { name, value: this.values[name] } : undefined;
    },
    set(name: string, value: string) {
      this.values[name] = value;
    },
  },
}));

vi.mock('@/lib/middleware/api-security', () => ({ logApiAuditEvent: m.logApiAuditEvent }));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => m.cookieStore) }));
vi.mock('@/lib/social-media/meta-api-client', () => ({ createMetaClient: m.createMetaClient }));
vi.mock('@/lib/social-media/twitter-api-client', () => ({ createTwitterClient: m.createTwitterClient }));
vi.mock('@/lib/social-media/linkedin-api-client', () => ({ createLinkedInClient: m.createLinkedInClient }));

vi.mock('@/db/schema/social-media-schema', () => {
  const col = (name: string) => ({ __col: name });
  return {
    socialAccounts: {
      id: col('id'),
      organizationId: col('organizationId'),
      platform: col('platform'),
      platformUserId: col('platformUserId'),
    },
  };
});

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: vi.fn(async (contextOrFn: unknown, maybeFn?: (tx: unknown) => Promise<unknown>) => {
    const hasContext = typeof contextOrFn !== 'function';
    m.withRLSContextCalls.push(hasContext ? contextOrFn : undefined);
    const fn = (hasContext ? maybeFn : contextOrFn) as (tx: unknown) => Promise<unknown>;
    const tx = {
      insert: (_table: unknown) => ({
        values: (values: Record<string, unknown>) => {
          m.insertedValues.push(values);
          return {
            onConflictDoUpdate: () => ({
              returning: async () => [{ id: 'new-account-id', platform: values.platform, username: values.username }],
            }),
          };
        },
      }),
    };
    return fn(tx);
  }),
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
  return import('../social-media/accounts/callback/route');
}

function callbackRequest(query: Record<string, string>) {
  const params = new URLSearchParams(query);
  return new NextRequest(`http://localhost/api/social-media/accounts/callback?${params.toString()}`);
}

describe('round 37: OAuth callback state/replay/PKCE/credential-exposure invariants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withRLSContextCalls.length = 0;
    m.insertedValues.length = 0;
    m.cookieStore.values = {};
  });

  it('required test #11 / negative: missing state is rejected', async () => {
    m.cookieStore.values.oauth_state = `${USER_B}:facebook:1000`;
    m.cookieStore.values.oauth_platform = 'facebook';
    const { GET } = await loadRoute();

    const response = await GET(callbackRequest({ code: 'auth-code' }));

    expect(response.status).toBe(400);
  });

  it('state mismatch is rejected', async () => {
    m.cookieStore.values.oauth_state = `${USER_B}:facebook:1000`;
    m.cookieStore.values.oauth_platform = 'facebook';
    const { GET } = await loadRoute();

    const response = await GET(callbackRequest({ code: 'auth-code', state: 'attacker-forged-state' }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('state replay is rejected: a second callback with the same query string fails after cookies are cleared', async () => {
    const state = `${USER_B}:facebook:1000`;
    m.cookieStore.values.oauth_state = state;
    m.cookieStore.values.oauth_platform = 'facebook';
    m.createMetaClient.mockReturnValue({
      getAccessToken: vi.fn(async () => ({ access_token: 'short-lived', expires_in: 3600 })),
      getLongLivedToken: vi.fn(async () => ({ access_token: 'long-lived', expires_in: 5_000_000 })),
      getUserPages: vi.fn(async () => [{ id: 'page-1', name: 'Page', access_token: 'page-token' }]),
    });
    const { GET } = await loadRoute();

    const first = await GET(callbackRequest({ code: 'auth-code', state }));
    expect(first.status).toBe(200);

    // Cookie was cleared by the first request; a replay of the exact same
    // callback request must now find no oauth_state to compare against.
    const replay = await GET(callbackRequest({ code: 'auth-code', state }));
    expect(replay.status).toBe(403);
  });

  it('a session other than the one that initiated the flow is rejected', async () => {
    const state = 'some-other-user:facebook:1000';
    m.cookieStore.values.oauth_state = state;
    m.cookieStore.values.oauth_platform = 'facebook';
    const { GET } = await loadRoute();

    const response = await GET(callbackRequest({ code: 'auth-code', state }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('a provider error parameter is rejected without attempting a code exchange', async () => {
    m.cookieStore.values.oauth_state = `${USER_B}:facebook:1000`;
    m.cookieStore.values.oauth_platform = 'facebook';
    const { GET } = await loadRoute();

    const response = await GET(callbackRequest({ error: 'access_denied', state: `${USER_B}:facebook:1000` }));

    expect(response.status).toBe(400);
    expect(m.createMetaClient).not.toHaveBeenCalled();
  });

  it('missing PKCE verifier fails Twitter exchange (verifier required and consumed)', async () => {
    const state = `${USER_B}:twitter:1000`;
    m.cookieStore.values.oauth_state = state;
    m.cookieStore.values.oauth_platform = 'twitter';
    // No twitter_code_verifier cookie set.
    const { GET } = await loadRoute();

    const response = await GET(callbackRequest({ code: 'auth-code', state }));

    expect(response.status).toBe(400);
    expect(m.createTwitterClient).not.toHaveBeenCalled();
  });

  it('Twitter exchange uses and consumes the PKCE verifier cookie', async () => {
    const state = `${USER_B}:twitter:1000`;
    m.cookieStore.values.oauth_state = state;
    m.cookieStore.values.oauth_platform = 'twitter';
    m.cookieStore.values.twitter_code_verifier = 'verifier-xyz';
    const getAccessToken = vi.fn(async () => ({ access_token: 'tw-access', refresh_token: 'tw-refresh', expires_in: 7200 }));
    const getMe = vi.fn(async () => ({ id: 'tw-1', username: 'unioneyes', name: 'Union Eyes' }));
    m.createTwitterClient.mockImplementation((accessToken?: string) => (accessToken ? { getMe } : { getAccessToken }));
    const { GET } = await loadRoute();

    const response = await GET(callbackRequest({ code: 'auth-code', state }));

    expect(response.status).toBe(200);
    expect(getAccessToken).toHaveBeenCalledWith('auth-code', expect.any(String), 'verifier-xyz');
    // PKCE verifier is single-use: cleared after this callback completes.
    expect(m.cookieStore.values.twitter_code_verifier).toBe('');
  });

  it('LinkedIn callback fails closed when no organization page is administered', async () => {
    const state = `${USER_B}:linkedin:1000`;
    m.cookieStore.values.oauth_state = state;
    m.cookieStore.values.oauth_platform = 'linkedin';
    const getAccessToken = vi.fn(async () => ({ access_token: 'li-access', expires_in: 1800 }));
    const getOrganizations = vi.fn(async () => []);
    m.createLinkedInClient.mockImplementation((accessToken?: string) => (accessToken ? { getOrganizations } : { getAccessToken }));
    const { GET } = await loadRoute();

    const response = await GET(callbackRequest({ code: 'auth-code', state }));

    expect(response.status).toBe(400);
    expect(m.insertedValues).toHaveLength(0);
  });

  it('successful connect derives organizationId only from the authenticated context and never returns credential material', async () => {
    const state = `${USER_B}:facebook:1000`;
    m.cookieStore.values.oauth_state = state;
    m.cookieStore.values.oauth_platform = 'facebook';
    m.createMetaClient.mockReturnValue({
      getAccessToken: vi.fn(async () => ({ access_token: 'short-lived', expires_in: 3600 })),
      getLongLivedToken: vi.fn(async () => ({ access_token: 'long-lived', expires_in: 5_000_000 })),
      getUserPages: vi.fn(async () => [{ id: 'page-1', name: 'Union Eyes Page', access_token: 'page-secret-token' }]),
    });
    const { GET } = await loadRoute();

    const response = await GET(callbackRequest({ code: 'auth-code', state }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(m.withRLSContextCalls).toContainEqual({ organizationId: ORG_B });
    expect(m.insertedValues[0]).toMatchObject({ organizationId: ORG_B, connectedBy: USER_B, platform: 'facebook' });

    // Never in the response.
    const serializedResponse = JSON.stringify(payload);
    expect(serializedResponse).not.toContain('page-secret-token');

    // Never in the audit log.
    const serializedAudit = JSON.stringify(m.logApiAuditEvent.mock.calls);
    expect(serializedAudit).not.toContain('page-secret-token');
    expect(serializedAudit).not.toContain('auth-code');
    expect(serializedAudit).not.toContain(state);

    // Temporary cookies cleared after terminal success.
    expect(m.cookieStore.values.oauth_state).toBe('');
    expect(m.cookieStore.values.oauth_platform).toBe('');
  });

  it('cookies are cleared even on a terminal failure path', async () => {
    m.cookieStore.values.oauth_state = `${USER_B}:facebook:1000`;
    m.cookieStore.values.oauth_platform = 'facebook';
    const { GET } = await loadRoute();

    await GET(callbackRequest({ code: 'auth-code', state: 'wrong-state' }));

    expect(m.cookieStore.values.oauth_state).toBe('');
    expect(m.cookieStore.values.oauth_platform).toBe('');
  });

  it('no organization context is rejected before any provider call is made', async () => {
    const { GET } = await loadRoute();

    const response = await GET(callbackRequest({ code: 'auth-code', state: 'x' }), { ...TEST_USER, organizationId: '' });

    expect(response.status).toBe(403);
    expect(m.createMetaClient).not.toHaveBeenCalled();
    expect(m.createTwitterClient).not.toHaveBeenCalled();
    expect(m.createLinkedInClient).not.toHaveBeenCalled();
  });
});

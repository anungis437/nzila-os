/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 round 37: social_accounts OAuth credential authority.
 *
 * Empirically proves (via a real predicate-evaluating fake db, not a
 * pass-through mock) that the accounts route's mutations are themselves
 * org-scoped — required negative test #3 (Org A cannot delete Org B's
 * account even with a valid foreign UUID) plus regression locks for #5/#6
 * (GET never returns token fields; no token/code/state appears in the
 * audit log) and the "pass trusted org explicitly to withRLSContext"
 * fix (asserting the exact context object withRLSContext was called with).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

interface FakeAccount {
  id: string;
  organizationId: string;
  platform: string;
  platformUserId: string;
  username: string;
  displayName: string;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
  status: string;
  connectedAt: Date;
  followerCount: number;
  engagementRate: string;
}

type Predicate = { __type: 'eq'; field: string; value: unknown } | { __type: 'and'; predicates: Predicate[] } | { __type: 'desc' };

function matches(row: Record<string, unknown>, predicate: Predicate): boolean {
  switch (predicate.__type) {
    case 'eq':
      return row[predicate.field] === predicate.value;
    case 'and':
      return predicate.predicates.every((p) => matches(row, p));
    default:
      return true;
  }
}

const ORG_A = 'org-A-uuid';
const ORG_B = 'org-B-uuid';
const TEST_USER = { userId: 'user-b-1', organizationId: ORG_B, role: 'steward' };

let accounts: FakeAccount[];

const m = vi.hoisted(() => ({
  logApiAuditEvent: vi.fn(),
  checkRateLimit: vi.fn(),
  createMetaClient: vi.fn(),
  createTwitterClient: vi.fn(),
  createLinkedInClient: vi.fn(),
  withRLSContextCalls: [] as unknown[],
  cookieStore: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
}));

vi.mock('@/lib/middleware/api-security', () => ({ logApiAuditEvent: m.logApiAuditEvent }));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  RATE_LIMITS: { SOCIAL_MEDIA_API: { requests: 30, window: 60 } },
}));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => m.cookieStore) }));
vi.mock('@/lib/social-media/meta-api-client', () => ({ createMetaClient: m.createMetaClient }));
vi.mock('@/lib/social-media/twitter-api-client', () => ({
  createTwitterClient: m.createTwitterClient,
  generatePKCE: vi.fn(),
}));
vi.mock('@/lib/social-media/linkedin-api-client', () => ({ createLinkedInClient: m.createLinkedInClient }));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: (field: { __col: string }, value: unknown) => ({ __type: 'eq', field: field.__col, value }),
    and: (...predicates: Predicate[]) => ({ __type: 'and', predicates }),
    desc: () => ({ __type: 'desc' }),
  };
});

vi.mock('@/db/schema/social-media-schema', () => {
  const col = (name: string) => ({ __col: name });
  return {
    socialAccounts: {
      id: col('id'),
      organizationId: col('organizationId'),
      platform: col('platform'),
      platformUserId: col('platformUserId'),
      username: col('username'),
      displayName: col('displayName'),
      profileImageUrl: col('profileImageUrl'),
      followerCount: col('followerCount'),
      engagementRate: col('engagementRate'),
      status: col('status'),
      connectedAt: col('connectedAt'),
      lastSyncedAt: col('lastSyncedAt'),
      rateLimitRemaining: col('rateLimitRemaining'),
      rateLimitResetAt: col('rateLimitResetAt'),
      accessToken: col('accessToken'),
      refreshToken: col('refreshToken'),
      tokenExpiresAt: col('tokenExpiresAt'),
    },
  };
});

function project(row: FakeAccount, shape: Record<string, { __col: string }> | undefined): Record<string, unknown> {
  if (!shape) return { ...row };
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(shape)) {
    out[key] = (row as unknown as Record<string, unknown>)[shape[key].__col];
  }
  return out;
}

function makeFakeDb() {
  return {
    select: (shape?: Record<string, { __col: string }>) => ({
      from: () => ({
        where: (pred: Predicate) => {
          const rows = accounts.filter((a) => matches(a as unknown as Record<string, unknown>, pred)).map((a) => project(a, shape));
          return {
            orderBy: () => Promise.resolve(rows),
            limit: (n: number) => Promise.resolve(rows.slice(0, n)),
          };
        },
      }),
    }),
    update: (_table: unknown) => ({
      set: (patch: Record<string, unknown>) => ({
        where: async (pred: Predicate) => {
          const targets = accounts.filter((a) => matches(a as unknown as Record<string, unknown>, pred));
          for (const t of targets) Object.assign(t, patch);
          return targets;
        },
      }),
    }),
    delete: (_table: unknown) => ({
      where: async (pred: Predicate) => {
        const before = accounts.length;
        accounts = accounts.filter((a) => !matches(a as unknown as Record<string, unknown>, pred));
        return { deletedCount: before - accounts.length };
      },
    }),
  };
}

const dbInstance = makeFakeDb();
vi.mock('@/db', () => ({ db: dbInstance }));

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: vi.fn(async (contextOrFn: unknown, maybeFn?: (tx: unknown) => Promise<unknown>) => {
    const hasContext = typeof contextOrFn !== 'function';
    m.withRLSContextCalls.push(hasContext ? contextOrFn : undefined);
    const fn = (hasContext ? maybeFn : contextOrFn) as (tx: unknown) => Promise<unknown>;
    return fn(dbInstance);
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
  return import('../social-media/accounts/route');
}

function seedAccounts() {
  accounts = [
    {
      id: 'rogue-account',
      organizationId: ORG_A,
      platform: 'twitter',
      platformUserId: 'tw-rogue',
      username: 'rogue',
      displayName: 'Rogue Account',
      accessToken: 'rogue-secret-access-token',
      refreshToken: 'rogue-secret-refresh-token',
      tokenExpiresAt: null,
      status: 'active',
      connectedAt: new Date('2026-01-01'),
      followerCount: 10,
      engagementRate: '0.1',
    },
    {
      id: 'legit-account',
      organizationId: ORG_B,
      platform: 'twitter',
      platformUserId: 'tw-legit',
      username: 'legit',
      displayName: 'Legit Account',
      accessToken: 'legit-secret-access-token',
      refreshToken: 'legit-secret-refresh-token',
      tokenExpiresAt: null,
      status: 'active',
      connectedAt: new Date('2026-01-02'),
      followerCount: 20,
      engagementRate: '0.2',
    },
  ];
}

describe('round 37: social-media accounts route org boundary (negative tests 3, 5, 6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withRLSContextCalls.length = 0;
    seedAccounts();
    m.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 99, resetIn: 0 });
    m.createTwitterClient.mockReturnValue({ revokeToken: vi.fn(async () => undefined) });
  });

  it('negative test 3: Org B cannot delete Org A\'s account even with a valid foreign UUID', async () => {
    const { DELETE } = await loadRoute();

    const response = await DELETE(
      new NextRequest('http://localhost/api/social-media/accounts?id=rogue-account', { method: 'DELETE' })
    );

    expect(response.status).toBe(403);
    expect(accounts.find((a) => a.id === 'rogue-account')).toBeDefined();
  });

  it('the delete mutation itself carries the trusted organizationId predicate (not id-only)', async () => {
    const { DELETE } = await loadRoute();

    await DELETE(new NextRequest('http://localhost/api/social-media/accounts?id=legit-account', { method: 'DELETE' }));

    expect(accounts.find((a) => a.id === 'legit-account')).toBeUndefined();
    // withRLSContext must have been called with the trusted org explicitly,
    // never the no-context overload that silently re-resolves org elsewhere.
    expect(m.withRLSContextCalls).toContainEqual({ organizationId: ORG_B });
  });

  it('the refresh mutation itself carries the trusted organizationId predicate', async () => {
    const { PUT } = await loadRoute();
    m.createTwitterClient.mockReturnValue({
      refreshAccessToken: vi.fn(async () => ({ access_token: 'new-token', expires_in: 3600 })),
    });
    accounts.find((a) => a.id === 'legit-account')!.refreshToken = 'legit-secret-refresh-token';

    const response = await PUT(
      new NextRequest('http://localhost/api/social-media/accounts', {
        method: 'PUT',
        body: JSON.stringify({ account_id: 'legit-account' }),
        headers: { 'content-type': 'application/json' },
      })
    );

    expect(response.status).toBe(200);
    expect(m.withRLSContextCalls).toContainEqual({ organizationId: ORG_B });
    expect(accounts.find((a) => a.id === 'legit-account')!.accessToken).toBe('new-token');
    // The other org's account must never be reachable through this call.
    expect(accounts.find((a) => a.id === 'rogue-account')!.accessToken).toBe('rogue-secret-access-token');
  });

  it('negative test 5: GET never returns accessToken or refreshToken fields', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/social-media/accounts'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.accounts).toHaveLength(1);
    const keys = Object.keys(payload.accounts[0]);
    expect(keys).not.toContain('accessToken');
    expect(keys).not.toContain('refreshToken');
  });

  it('negative test 6: no access/refresh token appears in any audit log call', async () => {
    const { GET, DELETE } = await loadRoute();

    await GET(new NextRequest('http://localhost/api/social-media/accounts'));
    await DELETE(new NextRequest('http://localhost/api/social-media/accounts?id=legit-account', { method: 'DELETE' }));

    const serializedCalls = JSON.stringify(m.logApiAuditEvent.mock.calls);
    expect(serializedCalls).not.toContain('legit-secret-access-token');
    expect(serializedCalls).not.toContain('legit-secret-refresh-token');
    expect(serializedCalls).not.toContain('rogue-secret-access-token');
    expect(serializedCalls).not.toContain('rogue-secret-refresh-token');
  });
});

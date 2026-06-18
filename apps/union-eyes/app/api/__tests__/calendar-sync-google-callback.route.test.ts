import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  exchangeCodeForTokens: vi.fn(),
  encryptCalendarToken: vi.fn(),
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
  withRLSContext: vi.fn(),
  standardErrorResponse: vi.fn(),
  selectQueue: [] as unknown[][],
}));

vi.mock('@/lib/api-auth-guard', () => ({ withRoleAuth: m.withRoleAuth, BaseAuthContext: {} }));
vi.mock('@/lib/external-calendar-sync/google-calendar-service', () => ({
  exchangeCodeForTokens: m.exchangeCodeForTokens,
}));
vi.mock('@/lib/external-calendar-sync/token-crypto', () => ({
  encryptCalendarToken: m.encryptCalendarToken,
}));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/api/standardized-responses', () => {
  const statusByCode: Record<string, number> = {
    AUTH_REQUIRED: 401,
    FORBIDDEN: 403,
    VALIDATION_ERROR: 400,
    SERVICE_UNAVAILABLE: 503,
    INTERNAL_ERROR: 500,
  };
  return {
    ErrorCode: {
      AUTH_REQUIRED: 'AUTH_REQUIRED',
      FORBIDDEN: 'FORBIDDEN',
      VALIDATION_ERROR: 'VALIDATION_ERROR',
      SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
      INTERNAL_ERROR: 'INTERNAL_ERROR',
    },
    standardErrorResponse: m.standardErrorResponse.mockImplementation((code: string, message: string) =>
      new Response(JSON.stringify({ code, message }), { status: statusByCode[code] ?? 400 })),
  };
});

async function loadRoute() {
  return import('../calendar-sync/google/callback/route');
}

describe('calendar-sync/google/callback route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.withRoleAuth.mockImplementation((_role: string, handler: any) => (request: any, ctx: any = { userId: 'u1', organizationId: 'org_1' }) => handler(request, ctx));
    m.exchangeCodeForTokens.mockResolvedValue({
      accessToken: 'access_123',
      refreshToken: 'refresh_123',
      expiresAt: new Date(Date.now() + 3600000),
    });
    m.encryptCalendarToken.mockReturnValue('encrypted_token');

    const createSelectChain = () => {
      const chain: {
        from: () => unknown;
        where: () => unknown;
        limit: () => unknown;
        then: (resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) => Promise<unknown>;
      } = {
        from: () => chain,
        where: () => chain,
        limit: () => chain,
        then: (resolve, reject) => Promise.resolve((m.selectQueue.shift() ?? []) as unknown[]).then(resolve, reject),
      };
      return chain;
    };

    m.db.select = vi.fn(() => createSelectChain());
    m.db.insert = vi.fn(() => ({ values: vi.fn(async () => null) }));
    m.db.update = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => null) })) }));
    m.withRLSContext.mockImplementation((fn: any) => fn());
  });

  it('returns auth required when user id is missing', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/calendar-sync/google/callback?code=abc'), { organizationId: 'org_1' });

    expect(response.status).toBe(401);
  });

  it('returns forbidden when organization id is missing', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/calendar-sync/google/callback?code=abc'), { userId: 'u1' });

    expect(response.status).toBe(403);
  });

  it('returns validation error when missing OAuth code', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/calendar-sync/google/callback'));
    expect(response.status).toBe(400);
  });

  it('handles OAuth state mismatch', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/calendar-sync/google/callback?code=abc&state=u999'));
    expect(response.status).toBe(403);
  });

  it('returns service unavailable when no refresh token exists for new connection', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([]);
    m.exchangeCodeForTokens.mockResolvedValueOnce({
      accessToken: 'access_123',
      refreshToken: null,
      expiresAt: new Date(Date.now() + 3600000),
    });

    const response = await GET(new NextRequest('http://localhost/api/calendar-sync/google/callback?code=oauth_code&state=u1'));

    expect(response.status).toBe(503);
  });

  it('creates a new google connection and redirects', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([]);

    const response = await GET(new NextRequest('http://localhost/api/calendar-sync/google/callback?code=oauth_code&state=u1'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/calendar?sync=connected&provider=google');
    expect(m.db.insert).toHaveBeenCalled();
  });

  it('updates existing connection when record already exists', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([{ id: 'existing_google_conn' }]);
    m.exchangeCodeForTokens.mockResolvedValueOnce({
      accessToken: 'access_123',
      refreshToken: null,
      expiresAt: new Date(Date.now() + 3600000),
    });

    const response = await GET(new NextRequest('http://localhost/api/calendar-sync/google/callback?code=oauth_code&state=u1'));

    expect(response.status).toBe(307);
    expect(m.db.update).toHaveBeenCalled();
  });
});

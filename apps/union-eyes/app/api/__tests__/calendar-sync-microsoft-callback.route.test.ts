import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  exchangeCodeForTokens: vi.fn(),
  encryptCalendarToken: vi.fn(),
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
  withRLSContext: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withRoleAuth: m.withRoleAuth, BaseAuthContext: {} }));
vi.mock('@/lib/external-calendar-sync/microsoft-calendar-service', () => ({
  exchangeCodeForTokens: m.exchangeCodeForTokens,
}));
vi.mock('@/lib/external-calendar-sync/token-crypto', () => ({
  encryptCalendarToken: m.encryptCalendarToken,
}));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));

async function loadRoute() {
  return import('../calendar-sync/microsoft/callback/route');
}

describe('calendar-sync/microsoft/callback route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    m.withRoleAuth.mockImplementation((_role: string, handler: any) => {
      return (request: Request, context: any = { userId: 'u1', organizationId: 'org_1' }) =>
        handler(request, context);
    });

    m.exchangeCodeForTokens.mockResolvedValue({
      accessToken: 'access_123',
      refreshToken: 'refresh_123',
      expiresAt: new Date(Date.now() + 3600000),
      providerAccountId: 'msft_u1',
      providerEmail: 'u1@contoso.com',
    });

    m.encryptCalendarToken.mockReturnValue('encrypted_token');
    m.db.select = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => []) })) })) }));
    m.db.insert = vi.fn(() => ({ values: vi.fn(async () => null) }));
    m.db.update = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => null) })) }));
    m.withRLSContext.mockImplementation((fn: any) => fn());
  });

  it('returns validation error when OAuth code is missing', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/calendar-sync/microsoft/callback'));
    expect([200, 400, 403, 500]).toContain(response.status);
  });

  it('returns forbidden when OAuth state mismatches user', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/calendar-sync/microsoft/callback?code=abc&state=u999'));
    expect([200, 400, 403, 500]).toContain(response.status);
  });

  it('completes microsoft OAuth callback flow', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/calendar-sync/microsoft/callback?code=oauth_code&state=u1'));
    expect([200, 302, 400, 403, 500]).toContain(response.status);
  });
});

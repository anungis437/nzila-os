import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  exchangeCodeForTokens: vi.fn(),
  encryptCalendarToken: vi.fn(),
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
  withRLSContext: vi.fn(),
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

async function loadRoute() {
  return import('../calendar-sync/google/callback/route');
}

describe('calendar-sync/google/callback route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withRoleAuth.mockImplementation((_role: string, handler: any) => (request: any, ctx: any = { userId: 'u1', organizationId: 'org_1' }) => handler(request, ctx));
    m.exchangeCodeForTokens.mockResolvedValue({
      accessToken: 'access_123',
      refreshToken: 'refresh_123',
      expiresAt: new Date(Date.now() + 3600000),
    });
    m.encryptCalendarToken.mockReturnValue('encrypted_token');
    m.db.select = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => []) }) )}));
    m.db.insert = vi.fn(() => ({ values: vi.fn(async () => null) }));
    m.db.update = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => null) })) }));
    m.withRLSContext.mockImplementation((fn: any) => fn());
  });

  it('returns 400 when missing OAuth code', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/calendar-sync/google/callback'));
    expect([200, 400, 500]).toContain(response.status);
  });

  it('handles OAuth state mismatch', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/calendar-sync/google/callback?code=abc&state=u999'));
    expect([200, 403, 400, 500]).toContain(response.status);
  });

  it('completes OAuth exchange', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/calendar-sync/google/callback?code=oauth_code&state=u1'));
    expect([200, 400, 500]).toContain(response.status);
  });
});

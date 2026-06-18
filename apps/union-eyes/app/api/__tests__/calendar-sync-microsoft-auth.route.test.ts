import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  getAuthorizationUrl: vi.fn(),
  standardErrorResponse: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withRoleAuth: m.withRoleAuth, BaseAuthContext: {} }));
vi.mock('@/lib/external-calendar-sync/microsoft-calendar-service', () => ({ getAuthorizationUrl: m.getAuthorizationUrl }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { AUTH_REQUIRED: 'AUTH_REQUIRED', INTERNAL_ERROR: 'INTERNAL_ERROR' },
  standardErrorResponse: m.standardErrorResponse,
}));

async function loadRoute() {
  return import('../calendar-sync/microsoft/auth/route');
}

describe('calendar-sync/microsoft/auth route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withRoleAuth.mockImplementation((_role: string, handler: any) => (request: NextRequest, context: any = { userId: 'u1' }) => handler(request, context));
    m.getAuthorizationUrl.mockResolvedValue('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    m.standardErrorResponse.mockImplementation((code: string, message: string) =>
      new Response(JSON.stringify({ code, message }), { status: code === 'AUTH_REQUIRED' ? 401 : 500 }));
  });

  it('returns auth required when user context is missing', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/calendar-sync/microsoft/auth'), { userId: null });

    expect(response.status).toBe(401);
  });

  it('redirects to Microsoft authorization URL for authenticated users', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/calendar-sync/microsoft/auth'), { userId: 'u1' });

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('microsoftonline.com');
    expect(m.getAuthorizationUrl).toHaveBeenCalledWith('u1');
  });

  it('returns internal error when URL generation fails', async () => {
    const { GET } = await loadRoute();
    m.getAuthorizationUrl.mockRejectedValueOnce(new Error('oauth unavailable'));

    const response = await GET(new NextRequest('http://localhost/api/calendar-sync/microsoft/auth'), { userId: 'u1' });

    expect(response.status).toBe(500);
  });
});
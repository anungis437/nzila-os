import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  isPlatformAdmin: vi.fn(),
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/lib/api-auth-guard', () => ({ isPlatformAdminUser: m.isPlatformAdmin }));

async function loadRoute() {
  return import('../test-auth/route');
}

describe('test-auth route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.isPlatformAdmin.mockResolvedValue(true);
    m.auth.mockResolvedValue({ userId: 'u1', orgId: 'org_1', getToken: vi.fn(async () => 'token-1') });
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:8000');
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/auth_core/health/')) return new Response(JSON.stringify({ ok: true }), { status: 200 });
      if (url.endsWith('/api/auth_core/me/')) return new Response(JSON.stringify({ id: 'u1' }), { status: 200 });
      return new Response(JSON.stringify({ error: 'unexpected' }), { status: 500 });
    }) as any;
  });

  it('verifies the auth gate end to end', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/test-auth'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.passed).toBe(true);
    expect(json.session.userId).toBe('u1');
  });

  it('refuses a signed-in user who is not a platform administrator, calling the backend with nothing', async () => {
    m.isPlatformAdmin.mockResolvedValue(false);
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/test-auth'));
    expect(response.status).toBe(403);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns backend statuses only, never the backend response bodies', async () => {
    const { GET } = await loadRoute();
    const json = await (await GET(new NextRequest('http://localhost/api/test-auth'))).json();
    expect(json.django.health).toEqual({ status: 200 });
    expect(json.django.me).toEqual({ status: 200 });
    expect(JSON.stringify(json)).not.toContain('"id":"u1"');
  });
});
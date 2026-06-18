import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));

async function loadRoute() {
  return import('../test-auth/route');
}

describe('test-auth route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
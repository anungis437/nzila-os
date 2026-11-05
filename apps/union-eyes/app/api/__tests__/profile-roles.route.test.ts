import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({ requireUser: vi.fn() }));

vi.mock('@/lib/api-auth-guard', () => ({ requireUser: m.requireUser }));
// The route must not reach the profiles table at all.
vi.mock('@/db', () => ({ db: new Proxy({}, { get: () => { throw new Error('profile/roles must not query the database'); } }) }));
vi.mock('@/db/schema', () => ({ profilesTable: {} }));

async function loadRoute() {
  return import('../profile/roles/route');
}

describe('profile/roles route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireUser.mockResolvedValue({ userId: 'u1', organizationId: 'org_1', roles: ['steward', 'member'], permissions: [] });
  });

  it('returns only the caller own roles for GET and POST', async () => {
    const { GET, POST } = await loadRoute();
    for (const handler of [GET, POST]) {
      const response = await handler();
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ role: 'steward', roles: ['steward', 'member'] });
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
  });

  it('ignores a userId in the request: the response is the caller, never the named user', async () => {
    const { POST } = await loadRoute();
    const handler = POST as unknown as (request?: NextRequest) => Promise<Response>;
    const response = await handler(new NextRequest('http://localhost/api/profile/roles', { method: 'POST', body: JSON.stringify({ userId: 'someone-else' }) }));
    expect(await response.json()).toEqual({ role: 'steward', roles: ['steward', 'member'] });
    expect(m.requireUser).toHaveBeenCalledTimes(1);
  });

  it('is 401 without a session and returns no profile data', async () => {
    const { GET } = await loadRoute();
    m.requireUser.mockRejectedValueOnce(new Error('Unauthorized'));
    const response = await GET();
    expect(response.status).toBe(401);
    expect(JSON.stringify(await response.json())).not.toMatch(/email|stripe|whop|tier|credit/i);
  });

  it('exposes no listing, creation, update or delete handler over the profiles table', async () => {
    const mod = (await loadRoute()) as Record<string, unknown>;
    for (const method of ['PUT', 'PATCH', 'DELETE']) expect(mod[method], method).toBeUndefined();
  });
});

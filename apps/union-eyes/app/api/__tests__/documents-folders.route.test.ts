import { vi, describe, expect, it } from 'vitest';

// Authentication is the guard's own contract; these tests exercise the retired handler behind it.
vi.mock('@/lib/api-auth-guard', () => ({ withApiAuth: (handler: unknown) => handler }));
import { NextRequest } from 'next/server';

async function loadRoute() {
  return import('../documents/folders/route');
}

describe('documents/folders route (retired)', () => {
  it('exports only GET and POST', async () => {
    const mod = await loadRoute();
    expect(typeof mod.GET).toBe('function');
    expect(typeof mod.POST).toBe('function');
    expect('PUT' in mod || 'PATCH' in mod || 'DELETE' in mod).toBe(false);
  });

  it.each(['', '?organizationId=00000000-0000-0000-0000-000000000999'])(
    'GET %s answers 501 NOT_IMPLEMENTED, with no cross-organization difference',
    async (query) => {
      const { GET } = await loadRoute();
      const response = await (GET as (request: NextRequest) => Promise<Response>)(new NextRequest(`http://localhost/api/documents/folders${query}`));
      expect(response.status).toBe(501);
      expect((await response.json()).error.code).toBe('NOT_IMPLEMENTED');
    },
  );

  it('POST answers 501 and creates no folder', async () => {
    const { POST } = await loadRoute();
    const response = await (POST as (request: NextRequest) => Promise<Response>)(new NextRequest('http://localhost/api/documents/folders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Grievance files', organizationId: '00000000-0000-0000-0000-000000000001' }),
    }));
    expect(response.status).toBe(501);
    expect((await response.json()).error.code).toBe('NOT_IMPLEMENTED');
  });
});

import { vi, describe, expect, it } from 'vitest';

// Authentication is the guard's own contract; these tests exercise the retired handler behind it.
vi.mock('@/lib/api-auth-guard', () => ({ withApiAuth: (handler: unknown) => handler }));
import { NextRequest } from 'next/server';

async function loadRoute() {
  return import('../documents/route');
}

describe('documents route (retired)', () => {
  it.each([
    ['requires no organizationId', ''],
    ['cross-organization', '?organizationId=00000000-0000-0000-0000-000000000999'],
    ['statistics mode', '?organizationId=00000000-0000-0000-0000-000000000001&statistics=true'],
    ['search mode', '?organizationId=00000000-0000-0000-0000-000000000001&search=true&searchQuery=policy'],
  ])('GET %s answers 501 NOT_IMPLEMENTED', async (_label, query) => {
    const { GET } = await loadRoute();
    const response = await (GET as (request: NextRequest) => Promise<Response>)(new NextRequest(`http://localhost/api/documents${query}`));
    expect(response.status).toBe(501);
    expect((await response.json()).error.code).toBe('NOT_IMPLEMENTED');
  });

  it('POST answers 501 NOT_IMPLEMENTED', async () => {
    const { POST } = await loadRoute();
    const response = await (POST as (request: NextRequest) => Promise<Response>)(new NextRequest('http://localhost/api/documents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Policy', fileUrl: 'https://example.com/p.pdf', fileType: 'pdf' }),
    }));
    expect(response.status).toBe(501);
    expect((await response.json()).error.code).toBe('NOT_IMPLEMENTED');
  });
});

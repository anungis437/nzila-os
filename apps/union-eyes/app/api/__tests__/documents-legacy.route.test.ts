import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

async function loadRoute() {
  return import('../documents/route');
}

describe('documents legacy route (retired)', () => {
  it('exports only GET and POST', async () => {
    const mod = await loadRoute();
    expect(typeof mod.GET).toBe('function');
    expect(typeof mod.POST).toBe('function');
    expect('PUT' in mod || 'PATCH' in mod || 'DELETE' in mod).toBe(false);
  });

  it.each(['?organizationId=00000000-0000-0000-0000-000000000001&statistics=true', '?organizationId=00000000-0000-0000-0000-000000000999', ''])(
    'GET %s answers 501 NOT_IMPLEMENTED and points to the repository',
    async (query) => {
      const { GET } = await loadRoute();
      const response = await (GET as (request: NextRequest) => Promise<Response>)(new NextRequest(`http://localhost/api/documents${query}`));
      expect(response.status).toBe(501);
      const body = await response.json();
      expect(body.error.code).toBe('NOT_IMPLEMENTED');
      expect(body.error.message).toContain('/api/documents/repository');
    },
  );

  it('POST answers 501 and creates nothing, even for a well-formed body', async () => {
    const { POST } = await loadRoute();
    const response = await (POST as (request: NextRequest) => Promise<Response>)(new NextRequest('http://localhost/api/documents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        organizationId: '00000000-0000-0000-0000-000000000001',
        name: 'Policy Pack',
        fileUrl: 'https://example.com/policy.pdf',
        fileType: 'pdf',
      }),
    }));
    expect(response.status).toBe(501);
    expect((await response.json()).error.code).toBe('NOT_IMPLEMENTED');
  });
});

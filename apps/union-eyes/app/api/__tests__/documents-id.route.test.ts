import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

async function loadRoute() {
  return import('../documents/[id]/route');
}

describe('documents/[id] route (retired)', () => {
  it('exports only GET, PATCH and DELETE', async () => {
    const mod = await loadRoute();
    expect(typeof mod.GET).toBe('function');
    expect(typeof mod.PATCH).toBe('function');
    expect(typeof mod.DELETE).toBe('function');
    expect('POST' in mod || 'PUT' in mod).toBe(false);
  });

  it.each(['GET', 'PATCH', 'DELETE'] as const)('%s answers 501 NOT_IMPLEMENTED and points to the repository document', async (method) => {
    const mod = await loadRoute();
    const handler = mod[method] as unknown as (request: NextRequest, context: unknown) => Promise<Response>;
    const response = await handler(
      new NextRequest('http://localhost/api/documents/doc_1', {
        method,
        headers: { 'content-type': 'application/json' },
        body: method === 'PATCH' ? JSON.stringify({ name: 'renamed', isImmutable: false }) : undefined,
      }),
      { params: Promise.resolve({ id: 'doc_1' }) },
    );
    expect(response.status).toBe(501);
    const body = await response.json();
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
    expect(body.error.message).toContain('/api/documents/repository/{id}');
  });
});

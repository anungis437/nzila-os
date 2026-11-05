import { vi, describe, expect, it } from 'vitest';

// Authentication is the guard's own contract; these tests exercise the retired handler behind it.
vi.mock('@/lib/api-auth-guard', () => ({ withApiAuth: (handler: unknown) => handler }));
import { NextRequest } from 'next/server';

async function loadRoute() {
  return import('../documents/bulk/route');
}

describe('documents/bulk route (retired)', () => {
  it('exports only POST', async () => {
    const mod = await loadRoute();
    expect(typeof mod.POST).toBe('function');
    expect('GET' in mod || 'PUT' in mod || 'PATCH' in mod || 'DELETE' in mod).toBe(false);
  });

  it.each([
    ['delete', { operation: 'delete', documentIds: ['d1'] }],
    ['move', { operation: 'move', documentIds: ['d1'], targetFolderId: 'f1' }],
    ['ocr', { operation: 'ocr', documentIds: ['d1'] }],
    ['malformed', '{bad-json'],
  ])('POST %s answers 501 NOT_IMPLEMENTED and performs no bulk operation', async (_label, body) => {
    const { POST } = await loadRoute();
    const response = await (POST as (request: NextRequest) => Promise<Response>)(new NextRequest('http://localhost/api/documents/bulk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }));
    expect(response.status).toBe(501);
    expect((await response.json()).error.code).toBe('NOT_IMPLEMENTED');
  });
});

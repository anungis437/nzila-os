import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api-auth-guard', () => ({
  withApiAuth: (handler: (request: NextRequest) => Promise<Response>) => handler,
}));

describe('admin/seed-cupe-pilot route (retired)', () => {
  it('performs no operation and says so', async () => {
    const { POST } = await import('../admin/seed-cupe-pilot/route');
    const response = await POST(new NextRequest('http://localhost/api/admin/seed-cupe-pilot', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reset: true }),
    }));
    expect(response.status).toBe(501);
    expect((await response.json()).error.code).toBe('NOT_IMPLEMENTED');
  });
});

import { vi, describe, expect, it } from 'vitest';

// Authentication is the guard's own contract; these tests exercise the retired handler behind it.
vi.mock('@/lib/api-auth-guard', () => ({ withApiAuth: (handler: unknown) => handler }));

async function loadRoute() {
  return import('../cases/outcomes/route');
}

describe('cases/outcomes route (retired)', () => {
  it('exports only GET and POST', async () => {
    const route = await loadRoute();
    expect(typeof route.GET).toBe('function');
    expect(typeof route.POST).toBe('function');
    expect('PUT' in route || 'PATCH' in route || 'DELETE' in route).toBe(false);
  });

  it.each(['GET', 'POST'] as const)('%s answers 501 NOT_IMPLEMENTED and writes nothing', async (method) => {
    const route = await loadRoute();
    const handler = route[method] as (request: Request) => Promise<Response>;
    const response = await handler(new Request('http://localhost/api/cases/outcomes', { method, body: method === 'POST' ? JSON.stringify({ outcome: 'won' }) : undefined }));
    expect(response.status).toBe(501);
    const body = await response.json();
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
    expect(body.error.message).toContain('/api/cases/{caseId}');
  });
});

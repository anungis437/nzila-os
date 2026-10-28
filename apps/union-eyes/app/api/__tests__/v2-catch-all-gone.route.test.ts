import { beforeEach, describe, expect, it, vi } from 'vitest';

// DEF-0B12-PLT-V2-CATCH-ALL-ANSWERS-200-FOR-POST-PUT-PATCH-AND-DELETE-SO-A-CALLER-IS-TOLD-A-WRITE-SUCCEEDED

const m = vi.hoisted(() => ({ log: vi.fn() }));

vi.mock('@/lib/api/with-api', () => ({
  withApi: (_cfg: unknown, handler: (c: unknown) => Promise<unknown>) => handler,
}));
vi.mock('@/lib/api/deprecation', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/deprecation')>('@/lib/api/deprecation');
  return { ...actual, logDeprecatedAccess: m.log };
});

describe('/api/v2/[...path] catch-all', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const)('answers 410 Gone to %s and never a success', async (method) => {
    const route = await import('../v2/[...path]/route');
    const response = await (route[method] as any)({
      request: { method },
      params: { path: ['admin', 'users', 'role'] },
    });
    expect(response.status).toBe(410);
    const body = await response.json();
    expect(body.error).toBe('Gone');
    expect(body.message).toContain('nothing was changed');
    expect(body).not.toHaveProperty('success');
    expect(m.log).toHaveBeenCalledWith('/api/v2/admin/users/role', method, '/api/admin/users/role');
  });

  it('handles a single-segment path parameter', async () => {
    const route = await import('../v2/[...path]/route');
    const response = await (route.POST as any)({ request: { method: 'POST' }, params: { path: 'claims' } });
    expect(response.status).toBe(410);
  });
});

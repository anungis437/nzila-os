import { beforeEach, describe, expect, it, vi } from 'vitest';

// DEF-0B12-PLT-V2-CATCH-ALL-ANSWERS-200-FOR-POST-PUT-PATCH-AND-DELETE-SO-A-CALLER-IS-TOLD-A-WRITE-SUCCEEDED

const m = vi.hoisted(() => ({ log: vi.fn(), warn: vi.fn() }));

vi.mock('@/lib/logger', () => ({ logger: { warn: m.warn, error: vi.fn(), info: vi.fn() } }));

vi.mock('@/lib/api/with-api', () => ({
  withApi: (_cfg: unknown, handler: (c: unknown) => Promise<unknown>) => handler,
}));
vi.mock('@/lib/api/deprecation', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/deprecation')>('@/lib/api/deprecation');
  return { ...actual, logDeprecatedAccess: m.log };
});

describe('/api/v2/[...path] catch-all', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.log.mockResolvedValue(undefined);
  });

  it.each(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const)('answers 410 Gone to %s and never a success', async (method) => {
    const route = await import('../v2/[...path]/route');
    const response = await (route[method] as any)({
      request: { method },
      params: { path: ['admin', 'users', 'role'] },
      userId: 'user_1',
      organizationId: 'org_1',
    });
    expect(response.status).toBe(410);
    const body = await response.json();
    expect(body.error).toBe('Gone');
    expect(body.message).toContain('nothing was changed');
    expect(body).not.toHaveProperty('success');
    // DEF-0B12-PLT-V2-CATCH-ALL-ACCESS-AUDIT-HAS-NO-ACTOR-AND-IS-NOT-AWAITED: the record names the caller and organization.
    expect(m.log).toHaveBeenCalledWith('/api/v2/admin/users/role', method, '/api/admin/users/role', 'user_1', 'org_1');
  });

  it('still answers 410 when the access record cannot be written, and says so in the log', async () => {
    m.log.mockRejectedValueOnce(new Error('audit down'));
    const route = await import('../v2/[...path]/route');
    const response = await (route.GET as any)({ request: { method: 'GET' }, params: { path: ['claims'] }, userId: 'user_1', organizationId: 'org_1' });
    expect(response.status).toBe(410);
    expect(m.warn).toHaveBeenCalled();
  });

  it('handles a single-segment path parameter', async () => {
    const route = await import('../v2/[...path]/route');
    const response = await (route.POST as any)({ request: { method: 'POST' }, params: { path: 'claims' } });
    expect(response.status).toBe(410);
  });
});

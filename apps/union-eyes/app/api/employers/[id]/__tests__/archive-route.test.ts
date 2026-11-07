import { describe, expect, it, vi } from 'vitest';

// DEF-0B6-EMP-REGISTRY-ARCHIVE-IGNORES-DEPENDENTS: DELETE /api/employers/{id} is the governed archive at the administrator floor, run in
// the caller's tenant transaction, never the generic status write.
const h = vi.hoisted(() => ({
  configs: [] as Array<{ cfg: { auth: { minRole: string }; rlsOrgContext?: boolean }; handler: (ctx: Record<string, unknown>) => Promise<unknown> }>,
  archive: vi.fn(async () => ({ id: 'e-1', status: 'archived' })),
  rls: vi.fn(async (_ctx: unknown, op: (tx: unknown) => Promise<unknown>) => op('tx')),
}));
vi.mock('@/lib/api/with-api', () => ({
  withApi: (cfg: never, handler: never) => { h.configs.push({ cfg, handler }); return handler; },
}));
vi.mock('@/lib/api/crud-factory', () => ({ crudRoutes: () => ({ GET: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() }) }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: h.rls }));
vi.mock('@/lib/union-structure/employer-archive', () => ({ archiveEmployerGoverned: h.archive }));

describe('DELETE /api/employers/{id}', () => {
  it('needs an administrator and archives through the governed action in the caller organization', async () => {
    const route = await import('../route');
    const del = h.configs.find((c) => c.handler === (route.DELETE as unknown))!;
    expect(del.cfg.auth.minRole).toBe('admin');
    expect(del.cfg.rlsOrgContext).toBe(true);
    await del.handler({ params: { id: 'e-1' }, organizationId: 'org-1', userId: 'admin-1' });
    expect(h.rls).toHaveBeenCalledWith({ organizationId: 'org-1', userId: 'admin-1' }, expect.any(Function));
    expect(h.archive).toHaveBeenCalledWith('tx', { organizationId: 'org-1', userId: 'admin-1', employerId: 'e-1' });
    await expect(del.handler({ params: { id: 'e-1' }, organizationId: null, userId: 'admin-1' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

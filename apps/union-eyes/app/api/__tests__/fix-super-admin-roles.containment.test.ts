import { describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ configs: [] as unknown[] }));
vi.mock('@/lib/api/framework', () => ({
  withApi: (cfg: unknown, handler: () => never) => { state.configs.push(cfg); return handler; },
  ApiError: { notImplemented: (reason: string) => new Error('NOT_IMPLEMENTED: ' + reason) },
}));

describe('legacy super-admin role repair — no implicit grant path', () => {
  it('requires an explicit system administration identity, refuses GET and POST, and exposes no roster', async () => {
    const { GET, POST } = await import('../admin/fix-super-admin-roles/route');
    expect(state.configs).toHaveLength(2);
    for (const config of state.configs) {
      expect(config).toMatchObject({ auth: { required: true, minRole: 'system_admin' } });
    }
    expect(() => GET({} as never)).toThrow('NOT_IMPLEMENTED');
    expect(() => POST({} as never)).toThrow('NOT_IMPLEMENTED');
  });
});

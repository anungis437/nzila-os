import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ auth: vi.fn(), isPlatformAdminUser: vi.fn() }));

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/lib/api-auth-guard', () => ({ isPlatformAdminUser: m.isPlatformAdminUser }));

describe('admin/system/cache route (retired)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.auth.mockResolvedValue({ userId: 'u1' });
    m.isPlatformAdminUser.mockResolvedValue(true);
  });

  it('tells a platform administrator it performs no operation instead of claiming a cache was cleared', async () => {
    const { POST } = await import('../admin/system/cache/route');
    const response = await POST();
    expect(response.status).toBe(501);
    const payload = await response.json();
    expect(payload.error.code).toBe('NOT_IMPLEMENTED');
    expect(JSON.stringify(payload)).not.toMatch(/cleared/i);
  });

  it('refuses everyone else', async () => {
    m.isPlatformAdminUser.mockResolvedValue(false);
    const { POST } = await import('../admin/system/cache/route');
    expect((await POST()).status).toBe(403);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));

async function loadRoute() {
  return import('../admin/system/cache/route');
}

describe('admin/system/cache route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PLATFORM_ADMIN_USER_IDS = 'admin_1';
    m.auth.mockResolvedValue({ userId: 'admin_1' });
  });

  it('returns 403 for non-admin users', async () => {
    const { POST } = await loadRoute();
    m.auth.mockResolvedValueOnce({ userId: 'member_1' });

    const response = await POST();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: 'Forbidden' });
  });

  it('returns success for platform admin', async () => {
    const { POST } = await loadRoute();

    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ success: true, message: 'Application cache cleared' });
  });
});
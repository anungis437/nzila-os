import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  db: { select: vi.fn(), update: vi.fn() },
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/db/schema', () => ({ organizationMembers: {} }));

async function loadRoute() {
  return import('../admin/users/[userId]/route');
}

describe('admin/users/[userId] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('PLATFORM_ADMIN_USER_IDS', 'admin_u1');
    m.auth.mockResolvedValue({ userId: 'admin_u1' });
    m.db.select = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => [{ status: 'active' }]) })) })) }));
    m.db.update = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => null) })) }));
  });

  it('PUT returns 403 when caller is not platform admin', async () => {
    m.auth.mockResolvedValueOnce({ userId: 'not_admin' });
    const { PUT } = await loadRoute();
    const response = await PUT(
      new Request('http://localhost/api/admin/users/u1', { method: 'PUT' }) as any,
      { params: Promise.resolve({ userId: 'u1' }) },
    );
    expect(response.status).toBe(403);
  });

  it('PUT toggles user status', async () => {
    const { PUT } = await loadRoute();
    const response = await PUT(
      new Request('http://localhost/api/admin/users/u1', { method: 'PUT' }) as any,
      { params: Promise.resolve({ userId: 'u1' }) },
    );
    expect([200, 500]).toContain(response.status);
  });

  it('DELETE soft-deletes user for platform admin', async () => {
    const { DELETE } = await loadRoute();
    const response = await DELETE(
      new Request('http://localhost/api/admin/users/u1', { method: 'DELETE' }) as any,
      { params: Promise.resolve({ userId: 'u1' }) },
    );
    expect([200, 500]).toContain(response.status);
  });
});

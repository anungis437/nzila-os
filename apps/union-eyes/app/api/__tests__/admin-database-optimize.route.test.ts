import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  dbExecute: vi.fn(),
  withSystemContext: vi.fn(),
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/db/db', () => ({ db: { execute: m.dbExecute } }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('drizzle-orm', () => ({ sql: vi.fn(() => 'SQL_ANALYZE') }));

async function loadRoute() {
  return import('../admin/database/optimize/route');
}

describe('admin/database/optimize route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PLATFORM_ADMIN_USER_IDS = 'admin_1,admin_2';
    m.auth.mockResolvedValue({ userId: 'admin_1' });
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.dbExecute.mockResolvedValue(undefined);
  });

  it('returns 403 when user is not a platform admin', async () => {
    const { POST } = await loadRoute();
    m.auth.mockResolvedValueOnce({ userId: 'member_1' });

    const response = await POST();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: 'Forbidden' });
  });

  it('returns success after ANALYZE executes', async () => {
    const { POST } = await loadRoute();

    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ success: true, message: expect.stringContaining('ANALYZE completed') });
    expect(m.dbExecute).toHaveBeenCalled();
  });

  it('returns 500 when optimization throws', async () => {
    const { POST } = await loadRoute();
    m.dbExecute.mockRejectedValueOnce(new Error('boom'));

    const response = await POST();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ success: false, error: 'Optimization failed' });
  });
});
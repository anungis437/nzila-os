import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  authority: vi.fn(),
  atomic: vi.fn(async (_actor: unknown, _read: unknown, operation: (tx: unknown) => Promise<unknown>) => operation('tx')),
  recent: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi }));
vi.mock('@/lib/audit/audited-platform-read', () => ({ performAtomicPlatformRead: m.atomic }));
vi.mock('@/lib/platform/platform-staff', () => ({ requirePlatformStaffAuthority: m.authority }));
vi.mock('@/lib/platform/user-directory', () => ({ recentMemberActivity: m.recent }));

const ctx = (query = '') => ({ request: new Request(`http://localhost/api/admin/stats/activity${query}`), userId: 'staff_1', organizationId: 'org_1' });

describe('admin/stats/activity route (DEF-0B2-PLATFORM-DIRECTORY-UNSCOPED-READ)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (c: any) => Promise<unknown>) => (c: any) => handler(c));
    m.authority.mockResolvedValue({ userId: 'staff_1', organizationId: 'org_1' });
    m.recent.mockResolvedValue([{ id: 'u1', type: 'member_added' }]);
  });

  it('refuses without platform-staff authority and reads nothing', async () => {
    m.authority.mockRejectedValue(Object.assign(new Error('no authority'), { status: 403 }));
    const { GET } = await import('../admin/stats/activity/route');

    await expect(GET(ctx())).rejects.toMatchObject({ status: 403 });

    expect(m.authority).toHaveBeenCalledWith(expect.objectContaining({ userId: 'staff_1' }), 'platform.member_activity.read');
    expect(m.atomic).not.toHaveBeenCalled();
    expect(m.recent).not.toHaveBeenCalled();
  });

  it('reads inside one system-scope audited transaction with a bounded limit', async () => {
    const { GET } = await import('../admin/stats/activity/route');

    expect(await GET(ctx('?limit=10'))).toEqual([{ id: 'u1', type: 'member_added' }]);
    expect(m.atomic).toHaveBeenCalledWith(
      { userId: 'staff_1', organizationId: 'org_1' },
      expect.objectContaining({ action: 'platform.member_activity.read', resourceType: 'organization_members', details: { limit: 10 } }),
      expect.any(Function),
    );
    expect(m.recent).toHaveBeenCalledWith('tx', 10);
  });

  it.each([['0', 1], ['-5', 1], ['9999', 50], ['abc', 10], ['3.9', 3]])('bounds a limit of %s to %d', async (raw, expected) => {
    const { GET } = await import('../admin/stats/activity/route');
    await GET(ctx(`?limit=${raw}`));
    expect(m.recent).toHaveBeenCalledWith('tx', expected);
  });
});
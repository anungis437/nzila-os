import { beforeEach, describe, expect, it, vi } from 'vitest';

// Issues #1116 / #1118: the cross-organization member activity feed is tenant content; platform-staff authority and a platform title are
// no entitlement to it and cross-organization grants are not built, so the route refuses every caller and reads nothing.
const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  authority: vi.fn(),
  atomic: vi.fn(),
  recent: vi.fn(),
}));

vi.mock('@/lib/api/framework', async () => {
  const { ApiError } = await import('@/lib/api/errors');
  return { withApi: m.withApi, ApiError };
});
vi.mock('@/lib/audit/audited-platform-read', () => ({ performAtomicPlatformRead: m.atomic }));
vi.mock('@/lib/platform/platform-staff', () => ({ requirePlatformStaffAuthority: m.authority }));
vi.mock('@/lib/platform/user-directory', () => ({ recentMemberActivity: m.recent }));

const ctx = (query = '') => ({ request: new Request(`http://localhost/api/admin/stats/activity${query}`), userId: 'staff_1', organizationId: 'org_1' });

describe('admin/stats/activity route (DEF-0B2-PLATFORM-DIRECTORY-UNSCOPED-READ, #1118)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (c: unknown) => Promise<unknown>) => (c: unknown) => handler(c));
    m.authority.mockResolvedValue({ userId: 'staff_1', organizationId: 'org_1' });
    m.recent.mockResolvedValue([{ id: 'u1', type: 'member_added' }]);
  });

  it('refuses a caller holding platform-staff authority, and reads no member row', async () => {
    const { GET } = await import('../admin/stats/activity/route');
    await expect(GET(ctx('?limit=10'))).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(m.atomic).not.toHaveBeenCalled();
    expect(m.recent).not.toHaveBeenCalled();
  });

  it('does not import the cross-organization activity reader at all', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const source = readFileSync(resolve(__dirname, '../admin/stats/activity/route.ts'), 'utf8');
    expect(source).not.toContain("from '@/lib/platform/user-directory'");
    expect(source).not.toContain('performAtomicPlatformRead');
  });
});

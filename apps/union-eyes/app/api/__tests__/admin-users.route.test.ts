import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  authority: vi.fn(),
  atomic: vi.fn(async (_actor: unknown, _read: unknown, operation: (tx: unknown) => Promise<unknown>) => operation('tx')),
  list: vi.fn(),
  direct: new Map<string, string>(),
}));

class TestApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
  static badRequest = (message: string) => new TestApiError(400, message);
  static forbidden = (message: string) => new TestApiError(403, message);
  static notFound = (resource: string) => new TestApiError(404, `${resource} not found`);
}
vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, ApiError: TestApiError }));
vi.mock('@/lib/audit/audited-platform-read', () => ({ performAtomicPlatformRead: m.atomic }));
vi.mock('@/lib/platform/platform-staff', () => ({ requirePlatformStaffAuthority: m.authority }));
vi.mock('@/lib/organizations/read-authority', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/organizations/read-authority')>()),
  resolveOrganizationAccess: async () => ({ direct: m.direct, affiliated: new Set() }),
}));
vi.mock('@/lib/platform/user-directory', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/platform/user-directory')>()), listPlatformUsers: m.list }));

const ctx = (query = '') => ({ request: new Request(`http://localhost/api/admin/users${query}`), userId: 'staff_1', organizationId: 'org_1' });
const ORG = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const MEMBER_OF = '33333333-3333-4333-8333-333333333333';

describe('admin/users route (DEF-0B2-PLATFORM-DIRECTORY-UNSCOPED-READ)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (c: any) => Promise<unknown>) => (c: any) => handler(c));
    m.authority.mockResolvedValue({ userId: 'staff_1', organizationId: 'org_1' });
    m.list.mockResolvedValue([{ id: 'u1', name: 'Ada', email: 'a***@example.com' }]);
    // The caller administers ORG directly and is an ordinary member of MEMBER_OF.
    m.direct = new Map([[ORG, 'admin'], [MEMBER_OF, 'member']]);
  });

  it('asks for platform-staff authority before anything else, and reads nothing without it', async () => {
    m.authority.mockRejectedValue(new TestApiError(403, 'Reading across organizations needs platform-staff authority'));
    const { GET } = await import('../admin/users/route');

    await expect(GET(ctx('?search=Ada'))).rejects.toMatchObject({ status: 403 });

    expect(m.authority).toHaveBeenCalledWith(expect.objectContaining({ userId: 'staff_1', organizationId: 'org_1' }), 'platform.user_directory.read');
    expect(m.atomic).not.toHaveBeenCalled();
    expect(m.list).not.toHaveBeenCalled();
  });

  it('reads inside one system-scope audited transaction and returns the projection the directory gives', async () => {
    const { GET } = await import('../admin/users/route');

    const result = await GET(ctx('?search=Ada'));

    expect(m.atomic).toHaveBeenCalledWith(
      { userId: 'staff_1', organizationId: 'org_1' },
      expect.objectContaining({
        action: 'platform.user_directory.read',
        resourceType: 'organization_members',
        details: { searched: true, scopedToOrganization: false, administeredOrganizations: 1, limit: 100 },
      }),
      expect.any(Function),
    );
    expect(m.list).toHaveBeenCalledWith('tx', { search: 'Ada', organizationId: null, organizationIds: [ORG] });
    expect(result).toEqual([{ id: 'u1', name: 'Ada', email: 'a***@example.com' }]);
  });

  it('records how many rows came back, never which', async () => {
    const { GET } = await import('../admin/users/route');
    await GET(ctx());

    const read = m.atomic.mock.calls[0][1] as { resultDetails: (rows: unknown[]) => unknown };
    expect(read.resultDetails([1, 2, 3])).toEqual({ returned: 3 });
  });

  it.each([['a'], ['ab']])('refuses a search of %j as too short to be a search, before reading', async (term) => {
    const { GET } = await import('../admin/users/route');
    await expect(GET(ctx(`?search=${term}`))).rejects.toMatchObject({ status: 400 });
    expect(m.atomic).not.toHaveBeenCalled();
  });

  it('narrows to one organization only when it is given an organization id, and refuses anything else', async () => {
    const { GET } = await import('../admin/users/route');
    await GET(ctx(`?organizationId=${ORG}`));
    expect(m.list).toHaveBeenCalledWith('tx', { search: '', organizationId: ORG, organizationIds: [ORG] });

    await expect(GET(ctx('?organizationId=not-an-id'))).rejects.toMatchObject({ status: 400 });
    await expect(GET(ctx(`?organizationId=${ORG}' OR '1'='1`))).rejects.toMatchObject({ status: 400 });
  });

  // Issue #1116: platform-staff authority is not authority over any organization's people.
  it('bounds the directory to organizations the caller directly administers, never another organization or one they only belong to', async () => {
    const { GET } = await import('../admin/users/route');
    await GET(ctx());
    expect(m.list.mock.calls[0][1].organizationIds).toEqual([ORG]);
  });

  it.each([[OTHER], [MEMBER_OF]])('answers not found for organization %s the caller does not administer, reading nothing', async (org) => {
    const { GET } = await import('../admin/users/route');
    await expect(GET(ctx(`?organizationId=${org}`))).rejects.toMatchObject({ status: 404 });
    expect(m.atomic).not.toHaveBeenCalled();
    expect(m.list).not.toHaveBeenCalled();
  });

  it('returns an empty directory, reading nothing, to platform staff who administer no organization directly', async () => {
    m.direct = new Map([[MEMBER_OF, 'member']]);
    const { GET } = await import('../admin/users/route');
    expect(await GET(ctx())).toEqual([]);
    expect(m.atomic).not.toHaveBeenCalled();
    expect(m.list).not.toHaveBeenCalled();
  });
});

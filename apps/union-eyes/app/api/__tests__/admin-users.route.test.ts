import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  authority: vi.fn(),
  atomic: vi.fn(async (_actor: unknown, _read: unknown, operation: (tx: unknown) => Promise<unknown>) => operation('tx')),
  list: vi.fn(),
}));

class TestApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
  static badRequest = (message: string) => new TestApiError(400, message);
  static forbidden = (message: string) => new TestApiError(403, message);
}
vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, ApiError: TestApiError }));
vi.mock('@/lib/audit/audited-platform-read', () => ({ performAtomicPlatformRead: m.atomic }));
vi.mock('@/lib/platform/platform-staff', () => ({ requirePlatformStaffAuthority: m.authority }));
vi.mock('@/lib/platform/user-directory', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/platform/user-directory')>()), listPlatformUsers: m.list }));

const ctx = (query = '') => ({ request: new Request(`http://localhost/api/admin/users${query}`), userId: 'staff_1', organizationId: 'org_1' });
const ORG = '11111111-1111-4111-8111-111111111111';

describe('admin/users route (DEF-0B2-PLATFORM-DIRECTORY-UNSCOPED-READ)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (c: any) => Promise<unknown>) => (c: any) => handler(c));
    m.authority.mockResolvedValue({ userId: 'staff_1', organizationId: 'org_1' });
    m.list.mockResolvedValue([{ id: 'u1', name: 'Ada', email: 'a***@example.com' }]);
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
      expect.objectContaining({ action: 'platform.user_directory.read', resourceType: 'organization_members', details: { searched: true, scopedToOrganization: false, limit: 100 } }),
      expect.any(Function),
    );
    expect(m.list).toHaveBeenCalledWith('tx', { search: 'Ada', organizationId: null });
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
    expect(m.list).toHaveBeenCalledWith('tx', { search: '', organizationId: ORG });

    await expect(GET(ctx('?organizationId=not-an-id'))).rejects.toMatchObject({ status: 400 });
    await expect(GET(ctx(`?organizationId=${ORG}' OR '1'='1`))).rejects.toMatchObject({ status: 400 });
  });
});
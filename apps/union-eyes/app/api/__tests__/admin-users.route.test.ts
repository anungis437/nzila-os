import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  resolveOrganizationAccess: vi.fn(),
  rows: [] as Array<Record<string, unknown>>,
  select: vi.fn(),
  where: vi.fn(),
}));
const org = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: { forbidden: (message: string) => Object.assign(new Error(message), { status: 403 }) },
}));
vi.mock('@/lib/organizations/read-authority', () => ({
  resolveOrganizationAccess: m.resolveOrganizationAccess,
  isAdministrativeRole: (role?: string) => role === 'admin',
}));
vi.mock('@/db/schema', () => ({
  organizationMembers: {
    id: 'id', name: 'name', email: 'email', role: 'role', organizationId: 'membershipOrg',
    deletedAt: 'deletedAt', status: 'status', joinedAt: 'joinedAt', createdAt: 'createdAt',
  },
  organizations: { id: 'organizationId', name: 'organizationName' },
}));
vi.mock('@/db/db', () => ({ db: { select: m.select } }));
vi.mock('drizzle-orm', async (original) => {
  const actual = await original<typeof import('drizzle-orm')>();
  return {
    ...actual,
    and: (...conditions: unknown[]) => ({ and: conditions }),
    eq: (field: unknown, value: unknown) => ({ eq: [field, value] }),
    isNull: (field: unknown) => ({ isNull: field }),
    or: (...conditions: unknown[]) => ({ or: conditions }),
    ilike: (field: unknown, value: unknown) => ({ ilike: [field, value] }),
    desc: (field: unknown) => ({ desc: field }),
  };
});
const request = (search = '') => new NextRequest('http://localhost/api/admin/users' + search);
const load = () => import('../admin/users/route');

beforeEach(() => {
  vi.clearAllMocks();
  m.rows = [];
  m.resolveOrganizationAccess.mockResolvedValue({ platform: false, direct: new Map([[org, 'admin']]), descendants: new Set() });
  m.withApi.mockImplementation((_opts: unknown, handler: (ctx: unknown) => Promise<unknown>) =>
    (req: NextRequest, extras: { userId?: string; organizationId?: string } = {}) =>
      handler({ request: req, userId: 'admin-1', organizationId: org, ...extras }));
  m.where.mockImplementation((_condition: unknown) => ({
    orderBy: () => ({ limit: async (_limit: number) => m.rows }),
  }));
  m.select.mockImplementation((_columns: unknown) => ({
    from: () => ({ leftJoin: () => ({ where: m.where }) }),
  }));
});

describe('admin/users - direct-tenant contact and membership boundary', () => {
  it('denies platform-only and federation-only roles before any database access', async () => {
    const { GET } = await load();
    for (const access of [
      { platform: true, direct: new Map(), descendants: new Set() },
      { platform: false, direct: new Map([['federation', 'admin']]), descendants: new Set([org]) },
    ]) {
      m.resolveOrganizationAccess.mockResolvedValueOnce(access);
      await expect(GET(request())).rejects.toMatchObject({ status: 403 });
    }
    expect(m.select).not.toHaveBeenCalled();
  });

  it('refuses an unaffiliated or missing context before reading any member', async () => {
    const { GET } = await load();
    await expect(GET(request(), { organizationId: undefined })).rejects.toMatchObject({ status: 403 });
    expect(m.select).not.toHaveBeenCalled();
  });

  it('returns only members of the administrated union even if a database adapter includes foreign records', async () => {
    const { GET } = await load();
    m.rows = [
      { id: 'member-1', name: 'Ada', email: 'ada@example.invalid', role: 'member', organizationId: org, organizationName: 'Union' },
      { id: 'member-2', name: 'Foreign', email: 'foreign@example.invalid', role: 'member', organizationId: other, organizationName: 'Other' },
    ];
    const result = await GET(request('?search=Ada'));
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'member-1', email: 'ada@example.invalid' });
    expect(JSON.stringify(m.where.mock.calls)).toContain(org);
    expect(JSON.stringify(m.where.mock.calls)).toContain('deletedAt');
    expect(JSON.stringify(m.where.mock.calls)).toContain('Ada');
    expect(m.select).toHaveBeenCalledTimes(1);
  });
});

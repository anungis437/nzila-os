import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withSystemContext: vi.fn(),
  db: { select: vi.fn() },
  organizationMembers: {
    organizationId: 'organizationId',
    deletedAt: 'deletedAt',
    name: 'name',
    email: 'email',
  },
  eq: vi.fn(),
  and: vi.fn(),
  isNull: vi.fn(),
  or: vi.fn(),
  ilike: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/db/schema-organizations', () => ({ organizationMembers: m.organizationMembers }));
vi.mock('drizzle-orm', () => ({
  eq: m.eq,
  and: m.and,
  isNull: m.isNull,
  or: m.or,
  ilike: m.ilike,
}));

async function loadRoute() {
  return import('../organization/members/search/route');
}

describe('organization/members/search route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: any) => (request: NextRequest) => handler({ request }));
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.eq.mockImplementation((a: unknown, b: unknown) => ({ a, b }));
    m.isNull.mockImplementation((a: unknown) => ({ isNull: a }));
    m.and.mockImplementation((...args: unknown[]) => args);
    m.or.mockImplementation((...args: unknown[]) => args);
    m.ilike.mockImplementation((a: unknown, b: unknown) => ({ a, b }));
  });

  it('returns empty members when organization param is missing', async () => {
    const { GET } = await loadRoute();

    const result = await GET(new NextRequest('http://localhost/api/organization/members/search?q=alex'));

    expect(result).toEqual({ members: [] });
    expect(m.withSystemContext).not.toHaveBeenCalled();
  });

  it('returns mapped members for org search with query text', async () => {
    const rows = [{
      id: 'om_1',
      name: 'Alex',
      email: 'alex@example.com',
      role: 'member',
      status: 'active',
      department: 'Operations',
      membershipNumber: null,
    }];
    const limit = vi.fn().mockResolvedValue(rows);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    m.db.select.mockReturnValue({ from });

    const { GET } = await loadRoute();
    const result = await GET(new NextRequest('http://localhost/api/organization/members/search?organization=org_1&q=alex'));

    expect(result).toEqual({
      members: [{
        id: 'om_1',
        name: 'Alex',
        email: 'alex@example.com',
        role: 'member',
        status: 'active',
        department: 'Operations',
        membershipNumber: '',
      }],
    });
    expect(m.ilike).toHaveBeenCalledTimes(2);
    expect(limit).toHaveBeenCalledWith(50);
  });
});
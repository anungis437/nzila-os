import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withRLSContext: vi.fn(),
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
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
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
    m.withApi.mockImplementation(
      (_cfg: unknown, handler: any) => (request: NextRequest) =>
        handler({ request, organizationId: new URL(request.url).searchParams.get('__test_org_id') }),
    );
    m.withRLSContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.eq.mockImplementation((a: unknown, b: unknown) => ({ a, b }));
    m.isNull.mockImplementation((a: unknown) => ({ isNull: a }));
    m.and.mockImplementation((...args: unknown[]) => args);
    m.or.mockImplementation((...args: unknown[]) => args);
    m.ilike.mockImplementation((a: unknown, b: unknown) => ({ a, b }));
  });

  it('returns empty members when the session has no resolved organization', async () => {
    const { GET } = await loadRoute();

    const result = await GET(new NextRequest('http://localhost/api/organization/members/search?q=alex'));

    expect(result).toEqual({ members: [] });
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });

  it('ignores a client-supplied ?organization= query parameter (IDOR regression guard)', async () => {
    const limit = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    m.db.select.mockReturnValue({ from });

    const { GET } = await loadRoute();
    await GET(
      new NextRequest(
        'http://localhost/api/organization/members/search?organization=attacker-org&__test_org_id=session-org&q=alex',
      ),
    );

    expect(m.eq).toHaveBeenCalledWith(m.organizationMembers.organizationId, 'session-org');
    expect(m.eq).not.toHaveBeenCalledWith(m.organizationMembers.organizationId, 'attacker-org');
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
    const result = await GET(new NextRequest('http://localhost/api/organization/members/search?__test_org_id=org_1&q=alex'));

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
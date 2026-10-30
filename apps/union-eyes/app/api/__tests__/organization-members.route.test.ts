import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withRLSContext: vi.fn(),
  db: { select: vi.fn() },
  organizationMembers: { organizationId: 'organizationId', deletedAt: 'deletedAt' },
  eq: vi.fn(),
  and: vi.fn(),
  isNull: vi.fn(),
  or: vi.fn(),
  sql: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/db/schema-organizations', () => ({ organizationMembers: m.organizationMembers }));
vi.mock('drizzle-orm', () => ({ eq: m.eq, and: m.and, isNull: m.isNull, or: m.or, sql: m.sql }));

async function loadRoute() {
  return import('../organization/members/route');
}

describe('organization/members route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation(
      (_cfg: unknown, handler: any) => (request: NextRequest) => {
        const params = new URL(request.url).searchParams;
        return handler({
          request,
          organizationId: params.get('__test_org_id'),
          userId: 'caller-1',
          user: { role: params.get('__test_role') ?? 'officer' },
        });
      },
    );
    m.withRLSContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.eq.mockImplementation((a: unknown, b: unknown) => ({ a, b }));
    m.isNull.mockImplementation((a: unknown) => ({ isNull: a }));
    m.and.mockImplementation((...args: unknown[]) => args);
    m.or.mockImplementation((...args: unknown[]) => ({ or: args }));
    m.sql.mockImplementation((parts: TemplateStringsArray, ...values: unknown[]) => ({ sql: parts.join('?'), values }));
  });

  it('denies a plain member and does not query the directory', async () => {
    const { GET } = await loadRoute();
    const res = await GET(new NextRequest('http://localhost/api/organization/members?__test_org_id=org_1&__test_role=member')) as Response;
    expect(res.status).toBe(403);
    expect(m.db.select).not.toHaveBeenCalled();
  });

  it('restricts a steward to case-context members of the active organization', async () => {
    const where = vi.fn().mockResolvedValue([]);
    m.db.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where }) });
    const { GET } = await loadRoute();
    await GET(new NextRequest('http://localhost/api/organization/members?__test_org_id=org_1&__test_role=steward'));
    const condition = JSON.stringify(where.mock.calls[0][0]);
    expect(condition).toContain('claims c');
    expect(condition).toContain('caller-1');
  });

  it('returns empty result when the session has no resolved organization', async () => {
    const { GET } = await loadRoute();

    const result = await GET(new NextRequest('http://localhost/api/organization/members'));

    expect(result).toEqual({ members: [], stats: { total: 0, active: 0 } });
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });

  it('ignores a client-supplied ?organization= query parameter (IDOR regression guard)', async () => {
    // Even if a caller appends ?organization=some-other-org, the route must
    // scope strictly by the framework-resolved organizationId (__test_org_id
    // here), never by a client-suppliable query parameter.
    const where = vi.fn().mockResolvedValue([]);
    const from = vi.fn().mockReturnValue({ where });
    m.db.select.mockReturnValue({ from });

    const { GET } = await loadRoute();
    await GET(
      new NextRequest(
        'http://localhost/api/organization/members?organization=attacker-org&__test_org_id=session-org',
      ),
    );

    expect(m.eq).toHaveBeenCalledWith(m.organizationMembers.organizationId, 'session-org');
    expect(m.eq).not.toHaveBeenCalledWith(m.organizationMembers.organizationId, 'attacker-org');
  });


  it('never includes membership numbers in a steward case-context directory projection', async () => {
    const rows = [{
      id: 'om_1', userId: 'u1', name: 'Alex', email: 'work@example.invalid',
      phone: '555-0101', role: 'member', status: 'active', department: 'Site',
      location: null, position: null, hireDate: null, seniority: null,
      membershipNumber: 'SENSITIVE-12345', unionJoinDate: null,
      createdAt: null, metadata: null,
    }];
    const where = vi.fn().mockResolvedValue(rows);
    m.db.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where }) });
    const { GET } = await loadRoute();
    const result = await GET(new NextRequest('http://localhost/api/organization/members?__test_org_id=org_1&__test_role=steward'));
    expect(result.members[0].membershipNumber).toBe('');
  });

  it('returns mapped members and stats for valid organization', async () => {
    const rows = [
      {
        id: 'om_1',
        userId: 'u1',
        name: 'Alex',
        email: 'alex@example.com',
        phone: null,
        role: 'member',
        status: 'active',
        department: null,
        location: null,
        position: null,
        hireDate: new Date('2020-01-01T00:00:00.000Z'),
        seniority: null,
        membershipNumber: null,
        unionJoinDate: null,
        createdAt: new Date('2021-01-01T00:00:00.000Z'),
        metadata: null,
      },
      {
        id: 'om_2',
        userId: 'u2',
        name: 'Pat',
        email: 'pat@example.com',
        phone: '555-0101',
        role: 'steward',
        status: 'inactive',
        department: 'Operations',
        location: 'North',
        position: 'Steward',
        hireDate: null,
        seniority: 5,
        membershipNumber: 'M-200',
        unionJoinDate: new Date('2019-05-10T00:00:00.000Z'),
        createdAt: null,
        metadata: { local: 12 },
      },
    ];

    const where = vi.fn().mockResolvedValue(rows);
    const from = vi.fn().mockReturnValue({ where });
    m.db.select.mockReturnValue({ from });

    const { GET } = await loadRoute();
    const result = await GET(new NextRequest('http://localhost/api/organization/members?__test_org_id=org_1'));

    expect(result).toMatchObject({ stats: { total: 2, active: 1 } });
    expect(result.members[0]).toMatchObject({
      id: 'om_1',
      phone: '',
      department: 'Administration',
      position: 'Union Member',
      membershipNumber: '',
    });
    expect(result.members[1]).toMatchObject({
      id: 'om_2',
      phone: '555-0101',
      department: 'Operations',
      membershipNumber: 'M-200',
      metadata: { local: 12 },
    });
  });
});
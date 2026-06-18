import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withSystemContext: vi.fn(),
  db: { select: vi.fn() },
  organizationMembers: { organizationId: 'organizationId', deletedAt: 'deletedAt' },
  eq: vi.fn(),
  and: vi.fn(),
  isNull: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/db/schema-organizations', () => ({ organizationMembers: m.organizationMembers }));
vi.mock('drizzle-orm', () => ({ eq: m.eq, and: m.and, isNull: m.isNull }));

async function loadRoute() {
  return import('../organization/members/route');
}

describe('organization/members route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: any) => (request: NextRequest) => handler({ request }));
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.eq.mockImplementation((a: unknown, b: unknown) => ({ a, b }));
    m.isNull.mockImplementation((a: unknown) => ({ isNull: a }));
    m.and.mockImplementation((...args: unknown[]) => args);
  });

  it('returns empty result when organization param is missing', async () => {
    const { GET } = await loadRoute();

    const result = await GET(new NextRequest('http://localhost/api/organization/members'));

    expect(result).toEqual({ members: [], stats: { total: 0, active: 0 } });
    expect(m.withSystemContext).not.toHaveBeenCalled();
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
    const result = await GET(new NextRequest('http://localhost/api/organization/members?organization=org_1'));

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
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { memberDirectoryAccess, projectDirectoryMember } from '@/lib/members/directory-access';
import { logger } from '@/lib/logger';

describe('member directory access policy', () => {
  it.each([
    ['member', 'none'],
    ['guest', 'none'],
    ['unknown_role', 'none'],
    [undefined, 'none'],
    ['steward', 'case-context'],
    ['union_rep', 'case-context'],
    ['chief_steward', 'organization'],
    ['business_agent', 'organization'],
    ['officer', 'organization'],
    ['admin', 'organization'],
  ])('%s receives %s scope', (role, scope) => {
    expect(memberDirectoryAccess(role as string | undefined).scope).toBe(scope);
  });

  it('limits sensitive attributes to officer-level authority', () => {
    expect(memberDirectoryAccess('steward').includeSensitive).toBe(false);
    expect(memberDirectoryAccess('chief_steward').includeSensitive).toBe(false);
    expect(memberDirectoryAccess('officer').includeSensitive).toBe(true);
  });

  it('platform administration is not authority over a customer organization: platform roles receive nothing', () => {
    for (const role of ['app_owner', 'system_admin', 'platform_lead', 'platform_admin', 'coo']) {
      expect(memberDirectoryAccess(role), role).toEqual({ scope: 'none', includeSensitive: false });
    }
  });

  it('removes employment dates, seniority and metadata from a non-sensitive projection', () => {
    const row = {
      id: '1', userId: 'u1', name: 'Pat', email: 'p@example.test', phone: '555', role: 'member', status: 'active',
      department: null, position: null, hireDate: new Date('2020-01-01'), seniority: 9, membershipNumber: 'M1',
      unionJoinDate: new Date('2019-01-01'), createdAt: new Date('2018-01-01'), metadata: { compensation: 1, medical: 'x' },
    };
    const limited = projectDirectoryMember(row, { scope: 'case-context', includeSensitive: false });
    expect(limited).toMatchObject({ hireDate: null, seniority: null, unionJoinDate: null, metadata: {} });
    const full = projectDirectoryMember(row, { scope: 'organization', includeSensitive: true });
    expect(full.metadata).toEqual({ compensation: 1, medical: 'x' });
    expect(full.seniority).toBe(9);
  });

  it('does not invent a department, a position or years of seniority that the record does not have', () => {
    const row = {
      id: '1', userId: 'u1', name: 'Pat', email: 'p@example.test', phone: null, role: 'member', status: 'active',
      department: null, position: null, hireDate: null, seniority: null, membershipNumber: null,
      unionJoinDate: null, createdAt: null, metadata: null,
    };
    for (const access of [{ scope: 'organization', includeSensitive: true }, { scope: 'case-context', includeSensitive: false }] as const) {
      const projected = projectDirectoryMember(row, access);
      expect(projected.department).toBeNull();
      expect(projected.position).toBeNull();
      expect(projected.seniority).toBeNull();
    }
    // A seniority of 0 that the record really holds is still 0 for an officer.
    expect(projectDirectoryMember({ ...row, seniority: 0 }, { scope: 'organization', includeSensitive: true }).seniority).toBe(0);
    expect(projectDirectoryMember({ ...row, department: 'Operations', position: 'Welder' }, { scope: 'organization', includeSensitive: true })).toMatchObject({ department: 'Operations', position: 'Welder' });
  });

  it('logs malformed legacy metadata instead of dropping it silently, without logging what it says', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const row = {
      id: 'om-7', userId: 'u7', name: 'Pat', email: 'p@example.test', phone: null, role: 'member', status: 'active',
      department: null, position: null, hireDate: null, seniority: null, membershipNumber: null,
      unionJoinDate: null, createdAt: null, metadata: '{"compensation": secret-salary',
    };
    const projected = projectDirectoryMember(row, { scope: 'organization', includeSensitive: true });
    expect(projected.metadata).toEqual({});
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls)).toContain('om-7');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('secret-salary');
    warn.mockRestore();

    // Valid JSON in the legacy string form is still read, and a non-sensitive projection reads none of it.
    expect(projectDirectoryMember({ ...row, metadata: '{"local":12}' }, { scope: 'organization', includeSensitive: true }).metadata).toEqual({ local: 12 });
    expect(projectDirectoryMember({ ...row, metadata: '{"local":12}' }, { scope: 'case-context', includeSensitive: false }).metadata).toEqual({});
  });
});

const m = vi.hoisted(() => ({
  rows: [] as unknown[],
  total: 0,
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  offset: vi.fn(),
  auditDataAccess: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: (_cfg: unknown, handler: (ctx: unknown) => unknown) => (ctx: unknown) => handler(ctx),
}));
// The page query goes on to order, limit and offset; the count query (select({ total })) is awaited at its where.
vi.mock('@/db/db', () => ({
  db: {
    select: (shape?: unknown) => ({
      from: () => ({
        where: (cond: unknown) => {
          m.where(cond);
          return Object.assign(Promise.resolve(shape ? [{ total: m.total }] : []), {
            orderBy: (...keys: unknown[]) => {
              m.orderBy(...keys);
              return {
                limit: (n: number) => {
                  m.limit(n);
                  return { offset: async (n2: number) => { m.offset(n2); return m.rows; } };
                },
              };
            },
          });
        },
      }),
    }),
  },
}));
vi.mock('@/db/schema-organizations', () => ({
  organizationMembers: new Proxy({}, { get: (_t, key) => ({ column: String(key) }) }),
}));
vi.mock('drizzle-orm', () => {
  const sql = (parts: TemplateStringsArray, ...values: unknown[]) => ({ sql: parts.join('?'), values });
  return {
    sql,
    eq: (a: unknown, b: unknown) => ({ eq: [a, b] }),
    and: (...c: unknown[]) => ({ and: c }),
    or: (...c: unknown[]) => ({ or: c }),
    isNull: (a: unknown) => ({ isNull: a }),
    ilike: (a: unknown, b: unknown) => ({ ilike: [a, b] }),
    asc: (a: unknown) => ({ asc: a }),
    count: () => ({ count: true }),
  };
});
vi.mock('@/lib/audit-logger', () => ({ auditDataAccess: m.auditDataAccess }));
vi.mock('@/lib/api-auth-guard', () => ({
  ROLE_HIERARCHY: { system_admin: 200, admin: 140, steward: 50, member: 20 },
  normalizeRole: (role: string) => role,
}));

const call = async (ctx: Record<string, unknown>, query = '') => {
  const { GET } = await import('../members/route');
  return GET({ request: new Request(`http://localhost/api/members${query}`), ...ctx }) as Promise<any>;
};

describe('GET /api/members', () => {
  beforeEach(() => { vi.clearAllMocks(); m.rows = []; m.total = 0; });

  it('denies an ordinary member the directory', async () => {
    const res = await call({ organizationId: 'org-1', userId: 'u1', user: { role: 'member' } });
    expect(res.status).toBe(403);
    expect(m.where).not.toHaveBeenCalled();
  });

  it('denies a cross-organization request from every caller, including a platform administrator', async () => {
    for (const role of ['admin', 'system_admin']) {
      const res = await call({ organizationId: 'org-1', userId: 'u1', user: { role } }, '?organizationId=org-2');
      expect(res.status, role).toBe(403);
    }
    expect(m.where).not.toHaveBeenCalled();
  });

  it('gives a platform administrator no directory in the active organization either', async () => {
    const res = await call({ organizationId: 'org-1', userId: 'p1', user: { role: 'system_admin' } });
    expect(res.status).toBe(403);
    expect(m.where).not.toHaveBeenCalled();
  });

  it('fails closed when there is no organization context', async () => {
    const res = await call({ userId: 'u1', user: { role: 'steward' } });
    expect(res.status).toBe(403);
  });

  it('restricts a steward to case-context members of the active organization', async () => {
    const result = await call({ organizationId: 'org-1', userId: 'steward-1', user: { role: 'steward' } });
    expect(result.members).toEqual([]);
    const condition = JSON.stringify(m.where.mock.calls[0][0]);
    expect(condition).toContain('claims c');
    expect(condition).toContain('steward-1');
    expect(condition).toContain('org-1');
    expect(m.auditDataAccess).toHaveBeenCalledWith(expect.objectContaining({ details: expect.objectContaining({ scope: 'case-context' }) }));
  });

  it('gives an admin the organization directory without the case-context restriction', async () => {
    await call({ organizationId: 'org-1', userId: 'a1', user: { role: 'admin' } });
    expect(JSON.stringify(m.where.mock.calls[0][0])).not.toContain('claims c');
  });

  const dbRow = (id: string, name: string) => ({
    id, userId: `u-${id}`, name, email: `${id}@union.example`, phone: null, role: 'member', status: 'active', department: null, position: null,
    hireDate: null, seniority: null, membershipNumber: null, unionJoinDate: null, createdAt: null, metadata: {},
  });

  it('reports how many members match, not how many are on the page, and counts them over the very same conditions', async () => {
    m.rows = [dbRow('m1', 'Ada'), dbRow('m2', 'Grace')];
    m.total = 137;
    const result = await call({ organizationId: 'org-1', userId: 'a1', user: { role: 'admin' } }, '?limit=2&offset=2&search=a&status=active');

    expect(result.members).toHaveLength(2);
    expect(result.total).toBe(137);
    expect(m.limit).toHaveBeenCalledWith(2);
    expect(m.offset).toHaveBeenCalledWith(2);
    // The page and the count are asked of the same condition: this organization, the search and the status.
    expect(m.where).toHaveBeenCalledTimes(2);
    expect(m.where.mock.calls[1][0]).toBe(m.where.mock.calls[0][0]);
    const condition = JSON.stringify(m.where.mock.calls[0][0]);
    expect(condition).toContain('org-1');
    expect(condition).toContain('active');
    expect(condition).toContain('%a%');
  });

  it('counts a steward\'s case-context members only, so the count carries the same restriction as the page', async () => {
    m.total = 3;
    const result = await call({ organizationId: 'org-1', userId: 'steward-1', user: { role: 'steward' } });
    expect(result.total).toBe(3);
    expect(JSON.stringify(m.where.mock.calls[1][0])).toContain('claims c');
    expect(JSON.stringify(m.where.mock.calls[1][0])).toContain('steward-1');
  });

  it('reports a total of zero for a directory with no matching member', async () => {
    const result = await call({ organizationId: 'org-1', userId: 'a1', user: { role: 'admin' } }, '?search=nobody');
    expect(result).toMatchObject({ members: [], total: 0 });
  });

  it('orders the page by name and then id, so that a page boundary neither repeats nor skips a member', async () => {
    await call({ organizationId: 'org-1', userId: 'a1', user: { role: 'admin' } });
    expect(m.orderBy).toHaveBeenCalledTimes(1);
    expect(m.orderBy).toHaveBeenCalledWith({ asc: { column: 'name' } }, { asc: { column: 'id' } });
  });
});

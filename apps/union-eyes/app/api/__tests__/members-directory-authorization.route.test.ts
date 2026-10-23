import { beforeEach, describe, expect, it, vi } from 'vitest';
import { memberDirectoryAccess, projectDirectoryMember } from '@/lib/members/directory-access';

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
    expect(memberDirectoryAccess('member', true)).toEqual({ scope: 'organization', includeSensitive: true });
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
});

const m = vi.hoisted(() => ({ rows: [] as unknown[], where: vi.fn(), auditDataAccess: vi.fn() }));

vi.mock('@/lib/api/framework', () => ({
  withApi: (_cfg: unknown, handler: (ctx: unknown) => unknown) => (ctx: unknown) => handler(ctx),
}));
vi.mock('@/db/db', () => ({
  db: {
    select: () => ({ from: () => ({ where: (cond: unknown) => { m.where(cond); return { limit: () => ({ offset: async () => m.rows }) }; } }) }),
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
  beforeEach(() => { vi.clearAllMocks(); m.rows = []; });

  it('denies an ordinary member the directory', async () => {
    const res = await call({ organizationId: 'org-1', userId: 'u1', user: { role: 'member' } });
    expect(res.status).toBe(403);
    expect(m.where).not.toHaveBeenCalled();
  });

  it('denies a cross-organization request from a non-platform administrator', async () => {
    const res = await call({ organizationId: 'org-1', userId: 'u1', user: { role: 'admin' } }, '?organizationId=org-2');
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
});

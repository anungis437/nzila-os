import { beforeEach, describe, expect, it, vi } from 'vitest';

const org = '11111111-1111-4111-8111-111111111111';
const m = vi.hoisted(() => ({
  resolveAccess: vi.fn(),
  selects: vi.fn(),
  conditions: [] as unknown[],
  limits: [] as number[],
  queue: [] as unknown[][],
}));
vi.mock('@/lib/api/framework', () => ({
  withApi: (_cfg: unknown, handler: (ctx: unknown) => unknown) => handler,
  ApiError: { forbidden: (message: string) => new Error('FORBIDDEN: ' + message) },
}));
vi.mock('@/lib/organizations/read-authority', () => ({
  resolveOrganizationAccess: m.resolveAccess,
  isAdministrativeRole: (role?: string) => role === 'admin',
}));
vi.mock('@/db/schema', () => ({
  organizations: {
    id: 'o.id', name: 'o.name', slug: 'o.slug',
    organizationType: 'o.type', provinceTerritory: 'o.province',
    memberCount: 'o.count', activeMemberCount: 'o.activeCount', status: 'o.status',
  },
  organizationMembers: {
    organizationId: 'm.org', role: 'm.role', status: 'm.status',
    name: 'm.name', email: 'm.email',
  },
}));
vi.mock('drizzle-orm', () => ({
  eq: (column: unknown, value: unknown) => ({ op: 'eq', column, value }),
  ne: (column: unknown, value: unknown) => ({ op: 'ne', column, value }),
  ilike: (column: unknown, value: unknown) => ({ op: 'ilike', column, value }),
  and: (...parts: unknown[]) => ({ op: 'and', parts }),
  or: (...parts: unknown[]) => ({ op: 'or', parts }),
  count: () => ({ count: true }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings: [...strings], values }),
}));
vi.mock('@/db/db', () => ({
  db: {
    select: (...args: unknown[]) => {
      m.selects(...args);
      return {
        from: () => ({
          where: (predicate: unknown) => {
            m.conditions.push(predicate);
            return {
              limit: async (n: number) => {
                m.limits.push(n);
                return m.queue.shift() ?? [];
              },
              groupBy: async () => m.queue.shift() ?? [],
            };
          },
        }),
      };
    },
  },
}));

const request = (search = '') => new Request('http://localhost/api/admin/organizations' + search);
const invoke = async (organizationId: string | null = org, userId: string | null = 'officer') => {
  const { GET } = await import('../admin/organizations/route');
  return GET({ request: request('?search=Local'), organizationId, userId } as never);
};

beforeEach(() => {
  vi.clearAllMocks();
  m.conditions = [];
  m.limits = [];
  m.queue = [];
  m.resolveAccess.mockResolvedValue({ direct: new Map([[org, 'admin']]), descendants: new Set(), platform: false });
});

describe('admin organizations — direct tenant scope for every data source', () => {
  it('rejects a title-only platform user and a federation-only administrator before any SQL read', async () => {
    for (const access of [
      { direct: new Map(), descendants: new Set(), platform: true },
      { direct: new Map([['parent-org', 'admin']]), descendants: new Set([org]), platform: false },
    ]) {
      m.resolveAccess.mockResolvedValueOnce(access);
      await expect(invoke()).rejects.toThrow(/direct organization administration mandate/);
    }
    expect(m.selects).not.toHaveBeenCalled();
  });

  it('refuses missing authenticated identity or tenant context without database access', async () => {
    await expect(invoke(null)).rejects.toThrow(/Active organization required/);
    await expect(invoke(org, null)).rejects.toThrow(/Active organization required/);
    expect(m.selects).not.toHaveBeenCalled();
  });

  it('bounds organization list, live counts and personal contacts to the same authenticated tenant', async () => {
    m.queue = [
      [{ id: org, name: 'Own Local', slug: 'own-local', provinceTerritory: 'ON', memberCount: 3, activeMemberCount: 2, status: 'active' }],
      [{ organizationId: org, total: 8, active: 6 }],
      [{ organizationId: org, name: 'President', email: 'private@example.invalid', role: 'president' }],
    ];
    const result = (await invoke()) as unknown as Array<Record<string, unknown>>;
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: org, memberCount: 8, activeCount: 6, contact: 'private@example.invalid' });
    expect(m.conditions).toHaveLength(3);
    for (const condition of m.conditions) expect(JSON.stringify(condition)).toContain(org);
    expect(JSON.stringify(m.conditions[0])).toContain('%Local%');
    expect(m.limits).toEqual([50, 25]);
  });
});

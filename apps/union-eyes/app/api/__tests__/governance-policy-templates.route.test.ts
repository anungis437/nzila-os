import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withRLSContext: vi.fn(),
  db: { select: vi.fn(), insert: vi.fn() },
  auditDataMutation: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/db/schema', () => ({ governancePolicies: { organizationId: 'organizationId', status: 'status', createdAt: 'createdAt' } }));
vi.mock('@/lib/audit-logger', () => ({ auditDataMutation: m.auditDataMutation }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), and: vi.fn(() => 'and'), desc: vi.fn(() => 'desc'), count: vi.fn(() => 'count'), sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../governance/policy-templates/route');
}

describe('governance/policy-templates route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.withRLSContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.auditDataMutation.mockResolvedValue(undefined);
    m.db.select
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => [{ total: 1 }]) })) }))
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn(() => ({ limit: vi.fn(() => ({ offset: vi.fn(async () => [{ id: 't1' }]) })) })) })) })) }));
    m.db.insert.mockReturnValue({ values: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 't2', title: 'Template' }]) })) });
  });

  it('lists policy templates', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ request: new Request('http://localhost/api/governance/policy-templates?page=1&limit=10'), organizationId: 'org_1' });

    expect(result).toEqual([{ id: 't1' }]);
  });

  it('creates a policy template', async () => {
    const { POST } = await loadRoute();
    const result = await POST({
      body: { title: 'Template', category: 'governance' },
      organizationId: 'org_1',
      userId: 'u1',
    });

    expect(result).toEqual({ id: 't2', title: 'Template' });
    expect(m.auditDataMutation).toHaveBeenCalled();
  });
});
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withSystemContext: vi.fn(),
  db: { select: vi.fn(), insert: vi.fn() },
  insertedValues: [] as Record<string, unknown>[],
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: {
    badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }),
  },
}));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@nzila/db/schema', () => ({ governedPolicies: { domain: 'domain', lifecycleStatus: 'lifecycleStatus', createdAt: 'createdAt' } }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    desc: vi.fn(() => 'desc'),
    eq: vi.fn(() => 'eq'),
    and: vi.fn(() => 'and'),
    sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }),
  };
});

async function loadRoute() {
  return import('../governance/lifecycle/policies/route');
}

describe('governance/lifecycle/policies route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) =>
      (ctx: any) => handler(ctx));
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.insertedValues = [];
    m.db.select.mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => ({ offset: vi.fn(async () => [{ id: 'p1', domain: 'finance' }]) })),
          })),
        })),
      })),
    } as any);
    m.db.insert.mockReturnValue({
      values: vi.fn((values: Record<string, unknown>) => {
        m.insertedValues.push(values);
        return { returning: vi.fn(async () => [{ id: 'p2', domain: 'finance' }]) };
      }),
    });
  });

  it('lists policies with filters', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ request: new Request('http://localhost/api/governance/lifecycle/policies?domain=finance&status=active&limit=25&offset=5') });

    expect(result).toEqual({ policies: [{ id: 'p1', domain: 'finance' }], limit: 25, offset: 5 });
  });

  it('creates a policy draft', async () => {
    const { POST } = await loadRoute();
    const result = await POST({
      request: new Request('http://localhost/api/governance/lifecycle/policies', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          policyFamilyId: 'family_1',
          semver: '1.0.0',
          name: 'Sample policy',
          domain: 'finance',
          authorRole: 'admin',
          governanceRationale: 'test',
        }),
      }),
      user: { id: 'u1' },
    });

    expect(result).toEqual({ policy: { id: 'p2', domain: 'finance' } });
    expect(m.insertedValues[0]?.authorId).toBe('u1');
    expect(m.insertedValues[0]?.authorId).not.toBe('system');
  });

  it('POST rejects a missing user and does not stamp a system actor', async () => {
    const { POST } = await loadRoute();

    await expect(POST({
      request: new Request('http://localhost/api/governance/lifecycle/policies', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          policyFamilyId: 'family_1',
          semver: '1.0.0',
          name: 'Sample policy',
          domain: 'finance',
          authorRole: 'admin',
          governanceRationale: 'test',
        }),
      }),
      user: null,
    })).rejects.toMatchObject({ status: 400 });

    expect(m.db.insert).not.toHaveBeenCalled();
    expect(m.withSystemContext).not.toHaveBeenCalled();
    expect(m.insertedValues).toHaveLength(0);
  });

  it('POST rejects a user without an id and does not write', async () => {
    const { POST } = await loadRoute();

    await expect(POST({
      request: new Request('http://localhost/api/governance/lifecycle/policies', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Sample policy' }),
      }),
      user: { id: '' },
    })).rejects.toMatchObject({ status: 400 });

    expect(m.db.insert).not.toHaveBeenCalled();
    expect(m.withSystemContext).not.toHaveBeenCalled();
  });
});
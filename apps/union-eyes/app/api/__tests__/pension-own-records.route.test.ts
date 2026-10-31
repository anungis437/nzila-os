import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  audit: vi.fn(),
  own: vi.fn(),
  conditions: [] as unknown[],
  inserted: [] as Record<string, unknown>[],
  tx: { select: vi.fn(), insert: vi.fn() },
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: {
    badRequest: (msg: string) => Object.assign(new Error(msg), { code: 'BAD_REQUEST' }),
    forbidden: (msg: string) => Object.assign(new Error(msg), { code: 'FORBIDDEN' }),
  },
}));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_org: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(m.tx),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));
vi.mock('@/lib/pension/pension-authority', () => ({
  isPensionAdministrator: (role: string) => role === 'secretary_treasurer',
  ownPensionIdentities: m.own,
  PENSION_ADMIN_ROLES: ['secretary_treasurer'],
}));
vi.mock('@/db/schema', () => {
  const t = (name: string) => new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });
  return { pensionBenefitClaims: t('claims'), pensionT4aRecords: t('t4a'), pensionContributions: t('contrib') };
});
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((c: unknown, v: unknown) => ({ eq: [c, v] })),
  and: vi.fn((...c: unknown[]) => ({ and: c })),
  desc: vi.fn(),
  inArray: vi.fn((c: unknown, v: unknown) => ({ inArray: [c, v] })),
}));

const MY_PENSION_ID = '00000000-0000-0000-0000-0000000000aa';
const OTHER_ID = '00000000-0000-0000-0000-0000000000bb';
const base = { organizationId: 'org_1', userId: 'u1' };

describe.each([
  ['benefits', '../pension/benefits/route', 'claims'],
  ['t4a', '../pension/t4a/route', 't4a'],
  ['contributions', '../pension/contributions/route', 'contrib'],
])('pension/%s GET', (_name, path, table) => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.conditions = [];
    m.withApi.mockImplementation((_cfg: unknown, handler: (c: any) => Promise<unknown>) => (c: any) => handler(c));
    m.own.mockResolvedValue(['membership-1', MY_PENSION_ID]);
    m.tx.select.mockReturnValue({
      from: () => ({
        where: (w: unknown) => {
          m.conditions.push(w);
          return { orderBy: () => ({ limit: () => ({ offset: async () => [{ id: 'row1' }] }) }) };
        },
      }),
    });
  });

  const get = async (ctx: Record<string, unknown>, query = '') => {
    const { GET } = await import(/* @vite-ignore */ path);
    return (GET as any)({ request: new Request(`http://localhost/api/x${query}`), ...base, ...ctx });
  };

  it('limits an ordinary member to their own records', async () => {
    await expect(get({ user: { role: 'member' } })).resolves.toEqual([{ id: 'row1' }]);
    expect(JSON.stringify(m.conditions)).toContain(`"inArray":["${table}.memberId",["membership-1","${MY_PENSION_ID}"]]`);
  });

  it('returns nothing to a caller with no membership, and does not query', async () => {
    m.own.mockResolvedValue([]);
    await expect(get({ user: { role: 'member' } })).resolves.toEqual([]);
    expect(m.tx.select).not.toHaveBeenCalled();
  });

  it("returns nothing for another member's id, even for a steward", async () => {
    await expect(get({ user: { role: 'steward' } }, `?memberId=${OTHER_ID}`)).resolves.toEqual([]);
    expect(m.tx.select).not.toHaveBeenCalled();
  });

  it('gives the pension administrator the organization-wide view, optionally for one member', async () => {
    await get({ user: { role: 'secretary_treasurer' } }, `?memberId=${OTHER_ID}`);
    expect(m.own).not.toHaveBeenCalled();
    expect(JSON.stringify(m.conditions)).toContain(OTHER_ID);
  });
});

describe('pension/benefits POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.inserted = [];
    m.withApi.mockImplementation((_cfg: unknown, handler: (c: any) => Promise<unknown>) => (c: any) => handler(c));
    m.own.mockResolvedValue(['membership-1', MY_PENSION_ID]);
    m.audit.mockResolvedValue(undefined);
    m.tx.insert.mockReturnValue({
      values: (v: Record<string, unknown>) => {
        m.inserted.push(v);
        return { returning: async () => [{ id: 'claim1', ...v }] };
      },
    });
  });

  const claim = { memberId: MY_PENSION_ID, memberName: 'Me', claimType: 'retirement', amount: '100.00' };

  it('files the member\'s own claim as pending, ignoring a decision they try to supply, and audits it', async () => {
    const { POST } = await import('../pension/benefits/route');
    await (POST as any)({ ...base, body: { ...claim, status: 'paid', processedDate: '2026-01-01' } });
    expect(m.inserted[0]).toMatchObject({ status: 'pending', organizationId: 'org_1', memberId: MY_PENSION_ID });
    expect(m.inserted[0]).not.toHaveProperty('processedDate');
    expect(m.audit).toHaveBeenCalledWith(m.tx, expect.objectContaining({ action: 'pension.benefit_claim.submit', userId: 'u1' }));
  });

  it('refuses a claim filed for someone else and writes nothing', async () => {
    const { POST } = await import('../pension/benefits/route');
    await expect((POST as any)({ ...base, body: { ...claim, memberId: OTHER_ID } })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(m.tx.insert).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
  });

  it('does not file the claim when its audit cannot be written', async () => {
    m.audit.mockRejectedValue(new Error('audit down'));
    const { POST } = await import('../pension/benefits/route');
    await expect((POST as any)({ ...base, body: claim })).rejects.toThrow('audit down');
  });
});

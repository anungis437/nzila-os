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
vi.mock('@/db/schema/board-packet-schema', () => ({ boardPackets: { createdAt: 'createdAt', organizationId: 'organizationId' } }));
vi.mock('@/lib/audit-logger', () => ({ auditDataMutation: m.auditDataMutation }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, desc: vi.fn(() => 'desc'), count: vi.fn(() => 'count'), eq: vi.fn(() => 'eq'), sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../governance/board-packets/route');
}

describe('governance/board-packets route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.withRLSContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.auditDataMutation.mockResolvedValue(undefined);
    m.db.select
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => [{ total: 1 }]) })) }))
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn(() => ({ limit: vi.fn(() => ({ offset: vi.fn(async () => [{ id: 'bp_1' }]) })) })) })) })) }));
    m.db.insert.mockReturnValue({ values: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'bp_2', title: 'Packet' }]) })) });
  });

  it('lists board packets', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ request: new Request('http://localhost/api/governance/board-packets?page=2&limit=5'), organizationId: 'org_1' });

    expect(result).toEqual([{ id: 'bp_1' }]);
  });

  it('creates a board packet', async () => {
    const { POST } = await loadRoute();
    const result = await POST({
      body: {
        title: 'Board Packet',
        packetType: 'quarterly',
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31',
        fiscalYear: 2026,
        generatedBy: 'system',
        financialSummary: {},
        membershipStats: {},
        caseSummary: {},
        complianceStatus: {},
        recipientRoles: ['admin'],
      },
      userId: 'u1',
      organizationId: 'org_1',
    });

    expect(result).toEqual({ id: 'bp_2', title: 'Packet' });
    expect(m.auditDataMutation).toHaveBeenCalled();
  });
});
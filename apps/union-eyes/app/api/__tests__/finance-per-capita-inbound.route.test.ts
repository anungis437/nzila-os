import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withRLSContext: vi.fn(),
  db: { execute: vi.fn() },
  getRemittanceStatusForParent: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, ApiError: { badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }) }, z: require('zod') }));
vi.mock('@/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/services/clc/per-capita-calculator', () => ({ getRemittanceStatusForParent: m.getRemittanceStatusForParent }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../finance/per-capita/inbound/route');
}

describe('finance/per-capita/inbound route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) =>
      (ctx: any) => handler(ctx));
    m.withRLSContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.db.execute.mockResolvedValue([{ childCount: '0' }]);
    m.getRemittanceStatusForParent.mockResolvedValue([{ totalDue: 10, totalPaid: 4, totalOverdue: 6 }]);
  });

  it('returns an empty payload when the organization is not a parent', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ organizationId: 'org_1', query: {} });

    expect(result.isParentOrg).toBe(false);
    expect(result.childCount).toBe(0);
    expect(result.totals).toEqual({ totalDue: 0, totalPaid: 0, totalOverdue: 0 });
  });

  it('returns remittance totals for a parent org', async () => {
    m.db.execute.mockResolvedValueOnce([{ childCount: '2' }]);
    const { GET } = await loadRoute();
    const result = await GET({ organizationId: 'org_1', query: { year: 2026 } });

    expect(result.isParentOrg).toBe(true);
    expect(result.childCount).toBe(2);
    expect(result.totals).toEqual({ totalDue: 10, totalPaid: 4, totalOverdue: 6 });
    expect(m.getRemittanceStatusForParent).toHaveBeenCalledWith('org_1', 2026);
  });
});
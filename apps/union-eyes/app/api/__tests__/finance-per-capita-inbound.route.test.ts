import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorCode } from '@/lib/api/errors';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withRLSContext: vi.fn(),
  db: { execute: vi.fn() },
  getRemittanceStatusForParent: vi.fn(),
  requireLiveFinancialMandate: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, ApiError: { badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }) }, z: require('zod') }));
vi.mock('@/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/finance/require-live-financial-mandate', () => ({ requireLiveFinancialMandate: m.requireLiveFinancialMandate }));
vi.mock('@/services/clc/per-capita-calculator', () => ({ getRemittanceStatusForParent: m.getRemittanceStatusForParent }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../finance/per-capita/inbound/route');
}

const REFUSAL = { status: 501, code: ErrorCode.NOT_IMPLEMENTED, message: 'Finance and dues persistence are not available in this release.' };

describe('finance/per-capita/inbound route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) =>
      (ctx: any) => handler(ctx));
    m.requireLiveFinancialMandate.mockResolvedValue({ mandateId: 'synthetic', ledgerWide: true, resourceIds: [], accountIds: [] });
    m.withRLSContext.mockImplementation(async (a: unknown, b?: unknown) => ((typeof a === 'function' ? a : b) as () => Promise<unknown>)());
    m.db.execute.mockResolvedValue([{ childCount: '0' }]);
    m.getRemittanceStatusForParent.mockResolvedValue([{ totalDue: 10, totalPaid: 4, totalOverdue: 6 }]);
  });

  it.each([
    ['a non-parent organization', [{ childCount: '0' }], {}],
    ['a parent organization', [{ childCount: '2' }], { year: 2026 }],
  ])('is refused with 501 before any mandate, database or remittance work, for %s', async (_label, executeRows, query) => {
    m.db.execute.mockResolvedValue(executeRows);
    const { GET } = await loadRoute();

    await expect(GET({ organizationId: 'org_1', userId: 'u1', query })).rejects.toMatchObject(REFUSAL);
    expect(m.requireLiveFinancialMandate).not.toHaveBeenCalled();
    expect(m.withRLSContext).not.toHaveBeenCalled();
    expect(m.db.execute).not.toHaveBeenCalled();
    expect(m.getRemittanceStatusForParent).not.toHaveBeenCalled();
  });
});

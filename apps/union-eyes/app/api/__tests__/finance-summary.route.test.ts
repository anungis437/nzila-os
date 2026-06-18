import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  execute: vi.fn(),
  withRLSContext: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => {
  const makeError = (status: number, message: string) => Object.assign(new Error(message), { status });
  return {
    withApi: vi.fn((_: unknown, handler: (...args: any[]) => unknown) => handler),
    ApiError: {
      badRequest: (message: string) => makeError(400, message),
    },
  };
});

vi.mock('@/db', () => ({
  db: {
    execute: m.execute,
  },
}));

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: m.withRLSContext,
}));

async function loadRoute() {
  return import('../finance/summary/route');
}

describe('finance/summary route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withRLSContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.execute
      .mockResolvedValueOnce([{ year: 2026, month: 1, amount: '100', memberCount: 10, expected: '110', variance: '-10', reconciled: true, status: 'ok' }])
      .mockResolvedValueOnce([{ totalPaid: '200', totalCharged: '400', uniqueMembers: 5 }])
      .mockResolvedValueOnce([{ totalMembers: 20, currentMembers: 15, warningMembers: 3, suspendedMembers: 2, onPaymentPlan: 1 }])
      .mockResolvedValueOnce([{ activePlans: 2, totalRemaining: '300', totalRecovered: '50' }])
      .mockResolvedValueOnce([{ year: 2026, month: 1, status: 'open', revenue: '1000', arrears: '200', memberCount: 20 }])
      .mockResolvedValueOnce([{ reconciled: 3, unreconciled: 1, unreconciledAmount: '20' }])
      .mockResolvedValueOnce([{ totalOrgMembers: 20 }])
      .mockResolvedValueOnce([{ totalDisbursements: 1, totalDisbursed: '50', craThresholdBreaches: 0, requiresT4a: 0, t4aGenerated: 0 }])
      .mockResolvedValueOnce([{ year: 2026, month: 1, amount: '40', members: 8, rate: '5', status: 'pending', dueDate: '2026-01-31' }])
      .mockResolvedValueOnce([{ orgId: 'child_1', orgName: 'Child Org', totalDue: '70', totalPaid: '10', totalOverdue: '5', pendingCount: 1, overdueCount: 1 }])
      .mockResolvedValueOnce([{ totalClaims: 7, openClaims: 2, totalLegalCosts: '500' }])
      .mockResolvedValueOnce([{ totalArbitrations: 2, estimatedCost: '100', actualCost: '80', unionShare: '40' }])
      .mockResolvedValueOnce([{ totalSettlements: 1, totalSettled: '25', accepted: 1 }])
      .mockResolvedValueOnce([{ totalMembers: 10, activeMembers: 8, totalYearsService: '60' }])
      .mockResolvedValueOnce([{ totalContributions: 3, received: 2, pending: 1, totalFunded: '90', totalPending: '10' }])
      .mockResolvedValueOnce([{ accountType: 'asset', balance: '1000' }, { accountType: 'liability', balance: '300' }])
      .mockResolvedValueOnce([{ name: 'Ops', totalBudget: '1000', allocated: '700', spent: '500', status: 'active' }]);
  });

  it('throws bad request when organization context is missing', async () => {
    const { GET } = await loadRoute();
    await expect(GET({ organizationId: '' } as any)).rejects.toMatchObject({ status: 400 });
  });

  it('returns normalized finance summary payload', async () => {
    const { GET } = await loadRoute();
    const payload = await GET({ organizationId: 'org_1' } as any);

    expect(payload).toMatchObject({
      collectionRate: 50,
      totalPaid: 200,
      totalCharged: 400,
      memberStanding: { total: 20 },
      strikeFund: { totalDisbursements: 1 },
      grievanceCosts: { totalClaims: 7 },
      pensionHealth: { totalMembers: 10 },
    });
    expect(payload.budgets).toHaveLength(1);
    expect(payload.perCapitaInbound.childCount).toBe(1);
  });
});

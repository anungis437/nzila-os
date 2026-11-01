/**
 * Financial safety regressions: service callers (including scheduled jobs) cannot
 * bypass the live mandate by skipping the HTTP route. A failed member calculation
 * must abort the transaction rather than commit a partially charged billing cycle.
 * These are mocked transaction/unit tests, NOT native PG rollback qualification.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  tx: { marker: 'tenant-transaction' },
  withRLSContext: vi.fn(),
  requireLiveFinancialMandate: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: m.withRLSContext,
}));
vi.mock('@/lib/finance/require-live-financial-mandate', () => ({
  requireLiveFinancialMandate: m.requireLiveFinancialMandate,
}));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));

import { BillingCycleService } from '../services/billing-cycle-service';

const params = {
  organizationId: '11111111-1111-4111-8111-111111111111',
  executedBy: '22222222-2222-4222-8222-222222222222',
  frequency: 'monthly' as const,
  periodStart: new Date('2026-10-01T00:00:00.000Z'),
  periodEnd: new Date('2026-10-31T23:59:59.999Z'),
};

describe('BillingCycleService transaction-owning financial controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withRLSContext.mockImplementation(async (_scope, fn) => fn(m.tx));
    m.requireLiveFinancialMandate.mockResolvedValue({ id: 'live-mandate' });
  });
  afterEach(() => vi.restoreAllMocks());

  it('refuses a direct service invocation without a live execution mandate before any member read', async () => {
    const readMembers = vi.spyOn(BillingCycleService as any, 'getActiveMembersForBilling');
    m.requireLiveFinancialMandate.mockRejectedValueOnce(new Error('DUTY_NOT_HELD'));

    await expect(BillingCycleService.generateBillingCycle(params)).rejects.toThrow('DUTY_NOT_HELD');

    expect(m.withRLSContext).toHaveBeenCalledWith(
      { organizationId: params.organizationId, userId: params.executedBy },
      expect.any(Function),
    );
    expect(m.requireLiveFinancialMandate).toHaveBeenCalledWith(m.tx, {
      organizationId: params.organizationId,
      userId: params.executedBy,
      action: 'finance:execute',
      requiresLedger: true,
    });
    expect(readMembers).not.toHaveBeenCalled();
  });

  it('throws inside the owning transaction when any member fails, rather than returning a successful partial charge', async () => {
    vi.spyOn(BillingCycleService as any, 'getActiveMembersForBilling').mockResolvedValue([
      { id: 'member-1' }, { id: 'member-2' },
    ]);
    const process = vi.spyOn(BillingCycleService as any, 'processMemberBilling')
      .mockResolvedValueOnce({ memberId: 'member-1', success: true, amount: 100, breakdown: { duesAmount: 85, copeAmount: 10, pacAmount: 3, strikeFundAmount: 2 } })
      .mockResolvedValueOnce({ memberId: 'member-2', success: false, error: 'missing dues assignment' });
    let threwInsideTransaction = false;
    m.withRLSContext.mockImplementationOnce(async (_scope, fn) => {
      try {
        return await fn(m.tx);
      } catch (error) {
        threwInsideTransaction = true;
        throw error;
      }
    });

    await expect(BillingCycleService.generateBillingCycle(params)).rejects.toThrow('Billing cycle aborted');
    expect(process).toHaveBeenCalledTimes(2);
    expect(threwInsideTransaction).toBe(true);
    expect(m.requireLiveFinancialMandate).toHaveBeenCalledWith(m.tx, expect.objectContaining({ action: 'finance:execute' }));
  });

  it('preserves preview diagnostics without claiming all members were successfully calculated', async () => {
    vi.spyOn(BillingCycleService as any, 'getActiveMembersForBilling').mockResolvedValue([{ id: 'member-1' }]);
    vi.spyOn(BillingCycleService as any, 'processMemberBilling')
      .mockResolvedValue({ memberId: 'member-1', success: false, error: 'missing wage data' });

    const result = await BillingCycleService.generateBillingCycle({ ...params, dryRun: true });
    expect(result.success).toBe(false);
    expect(result.members.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(m.requireLiveFinancialMandate).toHaveBeenCalledWith(m.tx, expect.objectContaining({ requiresLedger: true }));
  });
});

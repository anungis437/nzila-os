import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withRLSContext: vi.fn(),
  requireLiveFinancialMandate: vi.fn(),
  tx: { id: 'tenant-transaction' },
}));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: m.withRLSContext,
}));
vi.mock('@/lib/finance/require-live-financial-mandate', () => ({
  requireLiveFinancialMandate: m.requireLiveFinancialMandate,
}));

import { requireBillingCycleAuthority } from '../billing-cycle-authority';

const ORG = '11111111-1111-4111-8111-111111111111';

describe('billing-cycle target ledger authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withRLSContext.mockImplementation(async (_scope, fn) => fn(m.tx));
    m.requireLiveFinancialMandate.mockResolvedValue({ mandateId: 'mandate-1', ledgerWide: true });
  });

  it('requires a live execution mandate for the exact organization ledger and actor', async () => {
    await requireBillingCycleAuthority(ORG, 'user-1');
    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: ORG, userId: 'user-1' }, expect.any(Function));
    expect(m.requireLiveFinancialMandate).toHaveBeenCalledWith(m.tx, {
      organizationId: ORG, userId: 'user-1', action: 'finance:execute', requiresLedger: true,
    });
  });

  it('propagates mandate refusal and cannot authorize a billing cycle', async () => {
    m.requireLiveFinancialMandate.mockRejectedValueOnce(new Error('FINANCIAL_MANDATES_NOT_ISSUED'));
    await expect(requireBillingCycleAuthority(ORG, 'user-1')).rejects.toThrow('FINANCIAL_MANDATES_NOT_ISSUED');
  });

  it('propagates database errors rather than returning an apparent authorization', async () => {
    m.withRLSContext.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(requireBillingCycleAuthority(ORG, 'user-1')).rejects.toThrow('database unavailable');
    expect(m.requireLiveFinancialMandate).not.toHaveBeenCalled();
  });
});

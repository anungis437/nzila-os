import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findFirst: vi.fn(),
  revalidatePath: vi.fn(),
  loggerError: vi.fn(),
  createDiscountCode: vi.fn(),
  createCheckoutSession: vi.fn(),
  getOrganizationIdForUser: vi.fn(),
  svc: {
    createProgram: vi.fn(),
    updateProgram: vi.fn(),
    listPrograms: vi.fn(),
    createAwardType: vi.fn(),
    listAwardTypes: vi.fn(),
    createAwardRequest: vi.fn(),
    approveAward: vi.fn(),
    issueAward: vi.fn(),
    revokeAward: vi.fn(),
    listAwardsByStatus: vi.fn(),
    listUserAwards: vi.fn(),
    createBudgetEnvelope: vi.fn(),
    listBudgetEnvelopes: vi.fn(),
    getBudgetUsageSummary: vi.fn(),
    getBalance: vi.fn(),
    listLedger: vi.fn(),
    initiateRedemption: vi.fn(),
    updateRedemptionCheckout: vi.fn(),
    cancelRedemption: vi.fn(),
    listUserRedemptions: vi.fn(),
    getLedgerSummary: vi.fn(),
  },
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: mocks.auth }));

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: (_ctx: unknown, cb: (db: unknown) => unknown) =>
    cb({
      query: {
        organizationMembers: {
          findFirst: (opts?: { where?: (m: unknown, ops: unknown) => unknown }) => {
            // Exercise the where-clause arrow callbacks for coverage.
            opts?.where?.(
              { userId: 'c', organizationId: 'c' },
              { eq: () => true, and: () => true },
            );
            return mocks.findFirst();
          },
        },
      },
    }),
}));

vi.mock('@/lib/logger', () => ({ logger: { error: mocks.loggerError } }));
vi.mock('@/lib/services/rewards', () => mocks.svc);
vi.mock('@/lib/services/rewards/shopify-service', () => ({
  createDiscountCode: mocks.createDiscountCode,
  createCheckoutSession: mocks.createCheckoutSession,
}));

vi.mock('@/lib/validation/rewards-schemas', () => {
  const passthrough = { parse: (x: unknown) => x ?? {} };
  return {
    createProgramSchema: passthrough,
    updateProgramSchema: passthrough,
    createAwardTypeSchema: passthrough,
    createAwardSchema: passthrough,
    approveAwardSchema: passthrough,
    issueAwardSchema: passthrough,
    revokeAwardSchema: passthrough,
    createBudgetEnvelopeSchema: passthrough,
    initiateRedemptionSchema: passthrough,
    cancelRedemptionSchema: passthrough,
    paginationSchema: passthrough,
    awardStatusQuerySchema: passthrough,
    reportQuerySchema: passthrough,
  };
});

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: mocks.getOrganizationIdForUser }));

import * as actions from '../rewards-actions';

describe('rewards-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ userId: 'user-1', orgId: 'org-1' });
    mocks.getOrganizationIdForUser.mockResolvedValue('org-1');
    mocks.findFirst.mockReturnValue({ organizationId: 'org-1', role: 'admin' });
    for (const fn of Object.values(mocks.svc)) fn.mockResolvedValue({ id: 'x' });
    mocks.svc.listPrograms.mockResolvedValue([{ status: 'active' }, { status: 'inactive' }]);
    mocks.svc.listAwardTypes.mockResolvedValue([{ id: 'at1' }]);
    mocks.svc.listAwardsByStatus.mockResolvedValue([{ id: 'a1' }]);
    mocks.svc.listUserAwards.mockResolvedValue([{ id: 'a1' }]);
    mocks.svc.listBudgetEnvelopes.mockResolvedValue([{ id: 'b1' }]);
    mocks.svc.getBalance.mockResolvedValue(100);
    mocks.svc.listLedger.mockResolvedValue({ items: [] });
    mocks.svc.listUserRedemptions.mockResolvedValue({ items: [] });
    mocks.svc.initiateRedemption.mockResolvedValue({ id: 'r1' });
    mocks.svc.getLedgerSummary.mockResolvedValue({
      totalCreditsIssued: 1,
      totalCreditsSpent: 2,
      totalCreditsOutstanding: 3,
      activeMembers: 4,
    });
    mocks.createDiscountCode.mockResolvedValue({ code: 'DISC' });
    mocks.createCheckoutSession.mockResolvedValue({ checkoutUrl: 'https://shop/checkout' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe('programs', () => {
    it('createRecognitionProgram succeeds and reports failure', async () => {
      expect((await actions.createRecognitionProgram({})).success).toBe(true);
      mocks.svc.createProgram.mockRejectedValueOnce(new Error('boom'));
      expect((await actions.createRecognitionProgram({})).success).toBe(false);
    });

    it('updateRecognitionProgram succeeds', async () => {
      expect((await actions.updateRecognitionProgram('p1', {})).success).toBe(true);
    });

    it('listRecognitionPrograms succeeds', async () => {
      expect((await actions.listRecognitionPrograms()).success).toBe(true);
    });
  });

  describe('award types', () => {
    it('createRecognitionAwardType succeeds', async () => {
      expect((await actions.createRecognitionAwardType({})).success).toBe(true);
    });
    it('listAwardTypes succeeds', async () => {
      expect((await actions.listAwardTypes('p1')).success).toBe(true);
    });
  });

  describe('awards', () => {
    it('createAward succeeds', async () => {
      expect((await actions.createAward({})).success).toBe(true);
    });
    it('approveAward succeeds', async () => {
      expect((await actions.approveAward({})).success).toBe(true);
    });
    it('issueAward succeeds', async () => {
      expect((await actions.issueAward({})).success).toBe(true);
    });
    it('revokeAward succeeds', async () => {
      expect((await actions.revokeAward({})).success).toBe(true);
    });
    it('listAwardsByStatus succeeds', async () => {
      expect((await actions.listAwardsByStatus({ statuses: ['pending'], limit: 10, offset: 0 })).success).toBe(true);
    });
    it('listMyAwards succeeds and rejects unauth', async () => {
      expect((await actions.listMyAwards({})).success).toBe(true);
      mocks.auth.mockResolvedValueOnce({ userId: null });
      expect((await actions.listMyAwards()).success).toBe(false);
    });
  });

  describe('budget', () => {
    it('createBudgetEnvelope succeeds', async () => {
      const r = await actions.createBudgetEnvelope({ startsAt: '2025-01-01', endsAt: '2025-12-31' });
      expect(r.success).toBe(true);
    });
    it('listBudgetEnvelopes succeeds', async () => {
      expect((await actions.listBudgetEnvelopes('p1', true)).success).toBe(true);
    });
    it('getBudgetUsageSummary succeeds', async () => {
      expect((await actions.getBudgetUsageSummary('p1')).success).toBe(true);
    });
  });

  describe('wallet', () => {
    it('getMyWalletBalance succeeds and rejects unauth', async () => {
      expect((await actions.getMyWalletBalance()).success).toBe(true);
      mocks.auth.mockResolvedValueOnce({ userId: null });
      expect((await actions.getMyWalletBalance()).success).toBe(false);
    });
    it('getMyWalletLedger succeeds and rejects unauth', async () => {
      expect((await actions.getMyWalletLedger({})).success).toBe(true);
      mocks.auth.mockResolvedValueOnce({ userId: null });
      expect((await actions.getMyWalletLedger()).success).toBe(false);
    });
  });

  describe('redemptions', () => {
    it('initiateRedemption succeeds without Shopify', async () => {
      const r = await actions.initiateRedemption({ creditsToSpend: 10 });
      expect(r.success).toBe(true);
      expect((r as { data: { checkout_url?: string } }).data.checkout_url).toBeUndefined();
    });

    it('initiateRedemption integrates with Shopify when enabled', async () => {
      vi.stubEnv('SHOPIFY_ENABLED', 'true');
      const r = await actions.initiateRedemption({ creditsToSpend: 10 });
      expect(r.success).toBe(true);
      expect(mocks.svc.updateRedemptionCheckout).toHaveBeenCalled();
      expect((r as { data: { checkout_url?: string } }).data.checkout_url).toBe('https://shop/checkout');
    });

    it('initiateRedemption tolerates Shopify errors', async () => {
      vi.stubEnv('SHOPIFY_ENABLED', 'true');
      mocks.createDiscountCode.mockRejectedValueOnce(new Error('shopify down'));
      const r = await actions.initiateRedemption({ creditsToSpend: 10 });
      expect(r.success).toBe(true);
      expect(mocks.loggerError).toHaveBeenCalled();
    });

    it('initiateRedemption rejects unauth', async () => {
      mocks.auth.mockResolvedValueOnce({ userId: null });
      expect((await actions.initiateRedemption({ creditsToSpend: 10 })).success).toBe(false);
    });

    it('cancelRedemption succeeds', async () => {
      const r = await actions.cancelRedemption({ redemptionId: 'r1', reason: 'changed mind' });
      expect(r.success).toBe(true);
    });

    it('listMyRedemptions succeeds and rejects unauth', async () => {
      expect((await actions.listMyRedemptions({})).success).toBe(true);
      mocks.auth.mockResolvedValueOnce({ userId: null });
      expect((await actions.listMyRedemptions()).success).toBe(false);
    });
  });

  describe('reporting', () => {
    it('getRewardsSummary succeeds with date filters', async () => {
      const r = await actions.getRewardsSummary({
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        programId: 'p1',
      });
      expect(r.success).toBe(true);
      expect((r as { data: { active_programs_count: number } }).data.active_programs_count).toBe(1);
    });

    it('getRewardsSummary succeeds without date filters', async () => {
      expect((await actions.getRewardsSummary()).success).toBe(true);
    });
  });

  describe('auth & role resolution branches', () => {
    it('resolves org via RLS when no active org context', async () => {
      mocks.auth.mockResolvedValue({ userId: 'user-1', orgId: undefined });
      expect((await actions.listRecognitionPrograms()).success).toBe(true);
    });

    it('fails when the org id cannot be resolved', async () => {
      mocks.auth.mockResolvedValue({ userId: 'user-1', orgId: undefined });
      mocks.getOrganizationIdForUser.mockRejectedValueOnce(new Error('User not associated with any organization'));
      const r = await actions.listRecognitionPrograms();
      expect(r.success).toBe(false);
      expect(r.error).toContain('not associated');
    });

    it('fails admin-gated actions when the user has no organization membership', async () => {
      mocks.auth.mockResolvedValue({ userId: 'user-1', orgId: undefined });
      mocks.findFirst.mockReturnValue(undefined);
      const r = await actions.createRecognitionProgram({});
      expect(r.success).toBe(false);
      expect(r.error).toContain('not associated');
    });

    it('fails admin-gated actions for non-admin roles', async () => {
      mocks.findFirst.mockReturnValue({ organizationId: 'org-1', role: 'member' });
      const r = await actions.createRecognitionProgram({});
      expect(r.success).toBe(false);
      expect(r.error).toContain('Insufficient permissions');
    });

    it('fails admin-gated actions when membership is missing', async () => {
      mocks.findFirst.mockReturnValue(undefined);
      const r = await actions.createRecognitionProgram({});
      expect(r.success).toBe(false);
    });

    it('fails admin-gated actions when unauthenticated', async () => {
      mocks.auth.mockResolvedValue({ userId: null });
      const r = await actions.createRecognitionProgram({});
      expect(r.success).toBe(false);
      expect(r.error).toContain('Unauthorized');
    });
  });
});

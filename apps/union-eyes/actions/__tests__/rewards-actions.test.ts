import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

const ORG = '11111111-1111-4111-8111-111111111111';
const PROGRAM = '22222222-2222-4222-8222-222222222222';
const AWARD_TYPE = '33333333-3333-4333-8333-333333333333';
const AWARD = '44444444-4444-4444-8444-444444444444';
const REDEMPTION = '55555555-5555-4555-8555-555555555555';

const mocks = vi.hoisted(() => ({
  /** The organization whose transaction is open right now, as the services would see it. */
  activeOrg: { current: null as string | null },
  contexts: [] as Array<{ organizationId: string }>,
  members: { admin: undefined as unknown, recipient: undefined as unknown, recipientQueries: [] as unknown[] },
  auth: vi.fn(),
  revalidatePath: vi.fn(),
  loggerError: vi.fn(),
  createDiscountCode: vi.fn(),
  createCheckoutSession: vi.fn(),
  isStoreCheckoutUrl: vi.fn(),
  getOrganizationIdForUser: vi.fn(),
  auditRewards: vi.fn(),
  svc: {
    createProgram: vi.fn(),
    updateProgram: vi.fn(),
    getProgramById: vi.fn(),
    listPrograms: vi.fn(),
    createAwardType: vi.fn(),
    listAwardTypes: vi.fn(),
    createAwardRequest: vi.fn(),
    createPeerNomination: vi.fn(),
    approveAward: vi.fn(),
    issueAward: vi.fn(),
    revokeAward: vi.fn(),
    rejectAward: vi.fn(),
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

const tx = {
  marker: 'transaction',
  query: {
    organizationMembers: {
      // The administrator check passes a where callback, the recipient check a column list and a condition.
      findFirst: (options?: { columns?: unknown; where?: unknown }) => {
        if (!options?.columns) return mocks.members.admin;
        mocks.members.recipientQueries.push(options.where);
        return mocks.members.recipient;
      },
    },
  },
};

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: mocks.auth }));

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (context: { organizationId: string }, work: (transaction: unknown) => Promise<unknown>) => {
    mocks.contexts.push(context);
    const outer = mocks.activeOrg.current;
    mocks.activeOrg.current = context.organizationId;
    try {
      return await work(tx);
    } finally {
      mocks.activeOrg.current = outer;
    }
  },
}));

vi.mock('drizzle-orm', async (importOriginal) => ({
  ...(await importOriginal<typeof import('drizzle-orm')>()),
  and: (...conditions: unknown[]) => ({ and: conditions }),
  eq: (column: unknown, value: unknown) => ({ eq: [column, value] }),
  isNull: (column: unknown) => ({ isNull: column }),
}));
vi.mock('@/db/schema', () => ({
  organizationMembers: { id: 'id', organizationId: 'organizationId', userId: 'userId', status: 'status', deletedAt: 'deletedAt' },
}));

vi.mock('@/lib/logger', () => ({ logger: { error: mocks.loggerError } }));
vi.mock('@/lib/services/rewards', () => mocks.svc);
vi.mock('@/lib/services/rewards/audit', () => ({ auditRewards: mocks.auditRewards }));
vi.mock('@/lib/services/rewards/shopify-service', () => ({
  createDiscountCode: mocks.createDiscountCode,
  createCheckoutSession: mocks.createCheckoutSession,
  isStoreCheckoutUrl: mocks.isStoreCheckoutUrl,
}));

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: mocks.getOrganizationIdForUser }));

import * as actions from '../rewards-actions';
import { UserFacingError } from '@/lib/errors/user-facing-error';

/** The organization whose transaction was open when each service function ran (null: outside any transaction). */
const ranIn: Record<string, string | null> = {};
function serviceReturns(name: keyof typeof mocks.svc, result: unknown) {
  mocks.svc[name].mockImplementation(async () => {
    ranIn[name] = mocks.activeOrg.current;
    return result;
  });
}

describe('rewards-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.contexts.length = 0;
    mocks.members.recipientQueries.length = 0;
    mocks.activeOrg.current = null;
    for (const key of Object.keys(ranIn)) delete ranIn[key];
    mocks.members.admin = { organizationId: ORG, role: 'admin' };
    mocks.members.recipient = { id: 'member-row' };
    mocks.auth.mockResolvedValue({ userId: 'user-1', orgId: 'azure-group-guid' });
    mocks.getOrganizationIdForUser.mockResolvedValue(ORG);
    mocks.auditRewards.mockResolvedValue(undefined);
    for (const name of Object.keys(mocks.svc) as Array<keyof typeof mocks.svc>) serviceReturns(name, { id: 'x' });
    serviceReturns('createProgram', { id: PROGRAM, name: 'Recognition', status: 'draft' });
    serviceReturns('updateProgram', { id: PROGRAM });
    serviceReturns('getProgramById', { id: PROGRAM, orgId: ORG });
    serviceReturns('listPrograms', [{ status: 'active' }, { status: 'draft' }]);
    serviceReturns('createAwardType', { id: AWARD_TYPE });
    serviceReturns('listAwardTypes', [{ id: AWARD_TYPE }]);
    serviceReturns('listAwardsByStatus', [{ id: AWARD }]);
    serviceReturns('listUserAwards', [{ id: AWARD }]);
    serviceReturns('createBudgetEnvelope', { id: 'envelope-1' });
    serviceReturns('listBudgetEnvelopes', [{ id: 'envelope-1' }]);
    serviceReturns('getBalance', 100);
    serviceReturns('listLedger', { entries: [], total: 0 });
    serviceReturns('listUserRedemptions', { items: [] });
    serviceReturns('initiateRedemption', { id: REDEMPTION });
    serviceReturns('getLedgerSummary', {
      totalCreditsIssued: 1,
      totalCreditsSpent: 2,
      totalCreditsOutstanding: 3,
      activeMembers: 4,
    });
    mocks.createDiscountCode.mockImplementation(async () => {
      ranIn.createDiscountCode = mocks.activeOrg.current;
      return { code: 'DISC' };
    });
    mocks.createCheckoutSession.mockImplementation(async () => {
      ranIn.createCheckoutSession = mocks.activeOrg.current;
      return { checkoutUrl: 'https://shop/checkout' };
    });
    mocks.isStoreCheckoutUrl.mockReturnValue(true);
    serviceReturns('createPeerNomination', { id: AWARD, status: 'pending' });
    serviceReturns('rejectAward', { id: AWARD, status: 'rejected' });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('every database access runs in the organization of the signed-in member', () => {
    const cases: Array<[string, () => Promise<{ success: boolean; error?: string }>, Array<keyof typeof mocks.svc>]> = [
      ['createRecognitionProgram', () => actions.createRecognitionProgram({ name: 'Recognition' }), ['createProgram']],
      ['updateRecognitionProgram', () => actions.updateRecognitionProgram(PROGRAM, { name: 'Renamed' }), ['updateProgram']],
      ['listRecognitionPrograms', () => actions.listRecognitionPrograms(), ['listPrograms']],
      [
        'createRecognitionAwardType',
        () => actions.createRecognitionAwardType({ programId: PROGRAM, name: 'Thanks', kind: 'peer', defaultCreditAmount: 10 }),
        ['getProgramById', 'createAwardType'],
      ],
      ['listAwardTypes', () => actions.listAwardTypes(PROGRAM), ['listAwardTypes']],
      [
        'createAward',
        () => actions.createAward({ programId: PROGRAM, awardTypeId: AWARD_TYPE, recipientUserId: 'user-2', reason: 'Thanks' }),
        ['createAwardRequest'],
      ],
      ['approveAward', () => actions.approveAward({ awardId: AWARD }), ['approveAward']],
      ['issueAward', () => actions.issueAward({ awardId: AWARD }), ['issueAward']],
      ['revokeAward', () => actions.revokeAward({ awardId: AWARD, reason: 'Error' }), ['revokeAward']],
      ['rejectAward', () => actions.rejectAward({ awardId: AWARD, reason: 'Not eligible' }), ['rejectAward']],
      [
        'nominatePeer',
        () => actions.nominatePeer({ awardTypeId: AWARD_TYPE, recipientUserId: 'user-2', reason: 'Stayed late to help' }),
        ['createPeerNomination'],
      ],
      ['listAwardsByStatus', () => actions.listAwardsByStatus({ statuses: ['pending'] }), ['listAwardsByStatus']],
      ['listMyAwards', () => actions.listMyAwards(), ['listUserAwards']],
      [
        'createBudgetEnvelope',
        () =>
          actions.createBudgetEnvelope({
            programId: PROGRAM,
            name: 'Annual',
            period: 'annual',
            amountLimit: 1000,
            startsAt: '2025-01-01T00:00:00.000Z',
            endsAt: '2025-12-31T00:00:00.000Z',
          }),
        ['createBudgetEnvelope'],
      ],
      ['listBudgetEnvelopes', () => actions.listBudgetEnvelopes(PROGRAM, true), ['listBudgetEnvelopes']],
      ['getBudgetUsageSummary', () => actions.getBudgetUsageSummary(PROGRAM), ['getBudgetUsageSummary']],
      ['getMyWalletBalance', () => actions.getMyWalletBalance(), ['getBalance']],
      ['getMyWalletLedger', () => actions.getMyWalletLedger(), ['listLedger']],
      ['initiateRedemption', () => actions.initiateRedemption({ programId: PROGRAM, creditsToSpend: 10 }), ['getProgramById', 'initiateRedemption']],
      ['cancelRedemption', () => actions.cancelRedemption({ redemptionId: REDEMPTION, reason: 'Changed my mind' }), ['cancelRedemption']],
      ['listMyRedemptions', () => actions.listMyRedemptions(), ['listUserRedemptions']],
      [
        'getRewardsSummary',
        () => actions.getRewardsSummary(),
        ['getLedgerSummary', 'getBudgetUsageSummary', 'listPrograms', 'listAwardsByStatus'],
      ],
    ];

    it.each(cases)('%s', async (_name, run, services) => {
      const result = await run();

      expect(result.error).toBeUndefined();
      expect(result.success).toBe(true);
      for (const service of services) {
        expect(mocks.svc[service], service).toHaveBeenCalledTimes(1);
        expect(ranIn[service], `${service} ran in the organization's transaction`).toBe(ORG);
      }
    });

    it('takes the organization from the verified membership, never from the session group or the form', async () => {
      const result = await actions.createRecognitionProgram({ name: 'Recognition', orgId: 'forged', organizationId: 'forged' });

      expect(result.success).toBe(true);
      expect(mocks.getOrganizationIdForUser).toHaveBeenCalledWith('user-1');
      expect(mocks.svc.createProgram).toHaveBeenCalledWith({ orgId: ORG, name: 'Recognition', status: 'draft', currency: 'CAD' });
      expect(mocks.contexts.every((context) => context.organizationId === ORG)).toBe(true);
    });

    it.each(cases)('%s tells the caller nothing of what the database said when it fails', async (_name, run) => {
      const driverError = new Error(`Failed query: select "id" from "recognition_programs" where "org_id" = $1\nparams: ${ORG}`);
      for (const service of Object.values(mocks.svc)) service.mockRejectedValue(driverError);

      const result = await run();

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/^Something went wrong\. Please try again\. \(reference [0-9a-f]{8}\)$/);
      for (const fragment of ['Failed query', 'select', 'recognition_programs', 'params', ORG]) {
        expect(result.error, fragment).not.toContain(fragment);
      }
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
      // The failure is logged in full, under the reference the caller was given, for support.
      expect(mocks.loggerError).toHaveBeenCalledWith(
        expect.stringContaining('Server action failed: rewards.'),
        driverError,
        expect.objectContaining({ reference: result.error?.match(/reference ([0-9a-f]{8})/)?.[1] }),
      );
    });

    it('shows a validation failure as the fields and reasons', async () => {
      const result = await actions.createRecognitionProgram({ name: '' });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/^Invalid input\. name: /);
      expect(mocks.svc.createProgram).not.toHaveBeenCalled();
    });

    it('shows the domain error of a service, which is written for the caller', async () => {
      mocks.svc.issueAward.mockRejectedValueOnce(new UserFacingError('Insufficient budget to issue award'));

      expect(await actions.issueAward({ awardId: AWARD })).toEqual({ success: false, error: 'Insufficient budget to issue award' });
    });
  });

  describe('programs', () => {
    it('audits the creation on the transaction that stores it', async () => {
      await actions.createRecognitionProgram({ name: 'Recognition' });

      expect(mocks.auditRewards).toHaveBeenCalledWith(tx, {
        organizationId: ORG,
        userId: 'user-1',
        action: 'rewards.program.create',
        resourceType: 'recognition_programs',
        resourceId: PROGRAM,
        details: { name: 'Recognition', status: 'draft' },
      });
    });

    it('reports a failed creation and a failed audit instead of success, without what the driver said', async () => {
      mocks.svc.createProgram.mockRejectedValueOnce(new Error('boom'));
      const failed = await actions.createRecognitionProgram({ name: 'Recognition' });
      expect(failed).toEqual({ success: false, error: expect.stringMatching(/^Something went wrong\. Please try again\. \(reference [0-9a-f]{8}\)$/) });
      expect(failed.error).not.toContain('boom');

      mocks.auditRewards.mockRejectedValueOnce(new Error('audit sink unavailable'));
      const unaudited = await actions.createRecognitionProgram({ name: 'Recognition' });
      expect(unaudited.success).toBe(false);
      expect(unaudited.error).not.toContain('audit sink');
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it('audits an update with the fields it changed', async () => {
      const result = await actions.updateRecognitionProgram(PROGRAM, { name: 'Renamed' });

      expect(result.success).toBe(true);
      expect(mocks.auditRewards).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ action: 'rewards.program.update', resourceId: PROGRAM, details: { changed: ['name'] } }),
      );
    });

    it('is not a success when the update matched no program of this organization', async () => {
      mocks.svc.updateProgram.mockResolvedValueOnce(undefined);

      expect(await actions.updateRecognitionProgram(PROGRAM, { name: 'Renamed' })).toEqual({ success: false, error: 'Program not found' });
      expect(mocks.auditRewards).not.toHaveBeenCalled();
    });

    it('does not query a program id that is not a uuid', async () => {
      expect(await actions.updateRecognitionProgram('not-a-uuid', { name: 'x' })).toEqual({ success: false, error: 'Program not found' });
      expect(mocks.svc.updateProgram).not.toHaveBeenCalled();
    });
  });

  describe('award types', () => {
    const input = { programId: PROGRAM, name: 'Thanks', kind: 'peer', defaultCreditAmount: 10 };

    it('creates an award type of one of this organization programs and audits it', async () => {
      expect((await actions.createRecognitionAwardType(input)).success).toBe(true);

      expect(mocks.svc.getProgramById).toHaveBeenCalledWith(PROGRAM, ORG);
      expect(mocks.auditRewards).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ action: 'rewards.award_type.create', resourceType: 'recognition_award_types', resourceId: AWARD_TYPE }),
      );
    });

    it('refuses a program that is not this organization own, and stores nothing', async () => {
      mocks.svc.getProgramById.mockResolvedValueOnce(null);

      expect(await actions.createRecognitionAwardType(input)).toEqual({ success: false, error: 'Program not found' });
      expect(mocks.svc.createAwardType).not.toHaveBeenCalled();
      expect(mocks.auditRewards).not.toHaveBeenCalled();
    });

    it('does not list the award types of a program id that is not a uuid', async () => {
      expect((await actions.listAwardTypes('p1')).success).toBe(false);
      expect(mocks.svc.listAwardTypes).not.toHaveBeenCalled();
    });
  });

  describe('awards', () => {
    it('checks that the recipient is an active member of the organization before it creates the award', async () => {
      const input = { programId: PROGRAM, awardTypeId: AWARD_TYPE, recipientUserId: 'user-2', reason: 'Thanks' };
      expect((await actions.createAward(input)).success).toBe(true);
      expect(mocks.svc.createAwardRequest).toHaveBeenCalledWith(expect.objectContaining({ orgId: ORG, issuerUserId: 'user-1', recipientUserId: 'user-2' }));
      expect(mocks.members.recipientQueries).toEqual([
        {
          and: [
            { eq: ['organizationId', ORG] },
            { eq: ['userId', 'user-2'] },
            { eq: ['status', 'active'] },
            { isNull: 'deletedAt' },
          ],
        },
      ]);

      mocks.svc.createAwardRequest.mockClear();
      mocks.members.recipient = undefined;
      expect(await actions.createAward(input)).toEqual({ success: false, error: 'Recipient is not an active member of this organization' });
      expect(mocks.svc.createAwardRequest).not.toHaveBeenCalled();
    });

    it('records the issuing administrator, not the automation, as the actor of an issuance', async () => {
      await actions.issueAward({ awardId: AWARD });

      expect(mocks.svc.issueAward).toHaveBeenCalledWith({ awardId: AWARD, orgId: ORG, approvedByUserId: 'user-1' });
    });

    it('approves and revokes as the signed-in administrator', async () => {
      await actions.approveAward({ awardId: AWARD });
      await actions.revokeAward({ awardId: AWARD, reason: 'Error' });

      expect(mocks.svc.approveAward).toHaveBeenCalledWith({ awardId: AWARD, orgId: ORG, approvedByUserId: 'user-1' });
      expect(mocks.svc.revokeAward).toHaveBeenCalledWith({ awardId: AWARD, reason: 'Error', orgId: ORG, revokedByUserId: 'user-1' });
    });

    it('lists the signed-in member own awards, and rejects an unauthenticated caller', async () => {
      expect((await actions.listMyAwards({ limit: 5, offset: 10 })).success).toBe(true);
      expect(mocks.svc.listUserAwards).toHaveBeenCalledWith(ORG, 'user-1', 5, 10);

      mocks.auth.mockResolvedValueOnce({ userId: null });
      expect((await actions.listMyAwards()).success).toBe(false);
    });

    it('lists the awards in the requested statuses of the administrator organization', async () => {
      await actions.listAwardsByStatus({ statuses: ['pending', 'approved'], limit: 10, offset: 0 });

      expect(mocks.svc.listAwardsByStatus).toHaveBeenCalledWith(ORG, ['pending', 'approved'], 10, 0);
    });

    it('rejects a pending award as the signed-in administrator, with the reason, and only an administrator may', async () => {
      expect(await actions.rejectAward({ awardId: AWARD, reason: 'Not eligible' })).toEqual({ success: true, data: { id: AWARD, status: 'rejected' } });
      expect(mocks.svc.rejectAward).toHaveBeenCalledWith(AWARD, ORG, 'user-1', 'Not eligible');
      expect(ranIn.rejectAward).toBe(ORG);

      mocks.svc.rejectAward.mockClear();
      mocks.members.admin = { organizationId: ORG, role: 'member' };
      expect(await actions.rejectAward({ awardId: AWARD, reason: 'x' })).toEqual({ success: false, error: 'Insufficient permissions' });
      expect(mocks.svc.rejectAward).not.toHaveBeenCalled();
    });

    it('does not reject an award without a reason', async () => {
      const result = await actions.rejectAward({ awardId: AWARD, reason: '' });

      expect(result.success).toBe(false);
      expect(mocks.svc.rejectAward).not.toHaveBeenCalled();
    });
  });

  describe('peer nominations', () => {
    const nomination = { awardTypeId: AWARD_TYPE, recipientUserId: 'user-2', reason: '  Stayed late to help  ' };

    it('lets any signed-in member nominate, where creating an award is for administrators', async () => {
      mocks.members.admin = { organizationId: ORG, role: 'member' };

      expect(await actions.nominatePeer(nomination)).toEqual({ success: true, data: { id: AWARD, status: 'pending' } });
      expect(mocks.svc.createPeerNomination).toHaveBeenCalledWith({
        orgId: ORG,
        nominatorUserId: 'user-1',
        awardTypeId: AWARD_TYPE,
        recipientUserId: 'user-2',
        reason: 'Stayed late to help',
      });
      expect(ranIn.createPeerNomination).toBe(ORG);
      expect(mocks.revalidatePath).toHaveBeenCalledWith('/[locale]/dashboard/admin/rewards');

      expect(await actions.createAward({ programId: PROGRAM, awardTypeId: AWARD_TYPE, recipientUserId: 'user-2', reason: 'x' })).toEqual({
        success: false,
        error: 'Insufficient permissions',
      });
    });

    it('takes the organization from the signed-in member, never from the form', async () => {
      await actions.nominatePeer({ ...nomination, orgId: 'someone-elses', organizationId: 'someone-elses' });

      expect(mocks.svc.createPeerNomination).toHaveBeenCalledWith(expect.objectContaining({ orgId: ORG }));
      expect(mocks.contexts).toEqual([{ organizationId: ORG }]);
    });

    it('names the colleague as a current member of the organization, or stores nothing', async () => {
      await actions.nominatePeer(nomination);
      expect(mocks.members.recipientQueries).toHaveLength(1);

      mocks.svc.createPeerNomination.mockClear();
      mocks.members.recipient = undefined;
      expect(await actions.nominatePeer(nomination)).toEqual({ success: false, error: 'Recipient is not an active member of this organization' });
      expect(mocks.svc.createPeerNomination).not.toHaveBeenCalled();
    });

    it.each([
      ['an award type that is not a uuid', { ...nomination, awardTypeId: 'peer-thanks' }],
      ['no colleague', { ...nomination, recipientUserId: '' }],
      ['no reason', { ...nomination, reason: '   ' }],
      ['a reason over 500 characters', { ...nomination, reason: 'x'.repeat(501) }],
    ])('refuses %s without storing anything', async (_what, input) => {
      const result = await actions.nominatePeer(input);

      expect(result).toEqual({ success: false, error: expect.stringMatching(/^Invalid input/) });
      expect(mocks.svc.createPeerNomination).not.toHaveBeenCalled();
    });

    it('passes on the reason the service gives for refusing, in its words', async () => {
      mocks.svc.createPeerNomination.mockRejectedValueOnce(new UserFacingError('You cannot nominate yourself'));

      expect(await actions.nominatePeer(nomination)).toEqual({ success: false, error: 'You cannot nominate yourself' });
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it('is not a success when no row was written', async () => {
      mocks.svc.createPeerNomination.mockResolvedValueOnce(undefined);

      const result = await actions.nominatePeer(nomination);

      expect(result.success).toBe(false);
      expect(result).not.toHaveProperty('data');
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it('rejects an unauthenticated caller', async () => {
      mocks.auth.mockResolvedValueOnce({ userId: null });

      expect(await actions.nominatePeer(nomination)).toEqual({ success: false, error: 'Unauthorized' });
      expect(mocks.svc.createPeerNomination).not.toHaveBeenCalled();
    });
  });

  describe('budget', () => {
    it('audits an envelope with its program and limit', async () => {
      await actions.createBudgetEnvelope({
        programId: PROGRAM,
        name: 'Annual',
        period: 'annual',
        amountLimit: 1000,
        startsAt: '2025-01-01T00:00:00.000Z',
        endsAt: '2025-12-31T00:00:00.000Z',
      });

      expect(mocks.svc.createBudgetEnvelope).toHaveBeenCalledWith(
        expect.objectContaining({ orgId: ORG, startsAt: new Date('2025-01-01T00:00:00.000Z'), endsAt: new Date('2025-12-31T00:00:00.000Z') }),
      );
      expect(mocks.auditRewards).toHaveBeenCalledWith(tx, {
        organizationId: ORG,
        userId: 'user-1',
        action: 'rewards.budget_envelope.create',
        resourceType: 'reward_budget_envelopes',
        resourceId: 'envelope-1',
        details: { programId: PROGRAM, name: 'Annual', period: 'annual', amountLimit: 1000 },
      });
    });

    it('does not query a program id that is not a uuid', async () => {
      expect((await actions.listBudgetEnvelopes('p1')).success).toBe(false);
      expect((await actions.getBudgetUsageSummary('p1')).success).toBe(false);
      expect(mocks.svc.listBudgetEnvelopes).not.toHaveBeenCalled();
      expect(mocks.svc.getBudgetUsageSummary).not.toHaveBeenCalled();
    });

    it('summarises the whole organization when no program is named', async () => {
      expect((await actions.getBudgetUsageSummary()).success).toBe(true);
      expect(mocks.svc.getBudgetUsageSummary).toHaveBeenCalledWith(ORG, undefined);
    });
  });

  describe('wallet', () => {
    it('reads the balance and the ledger of the signed-in member in their organization', async () => {
      expect(await actions.getMyWalletBalance()).toEqual({ success: true, data: { balance: 100 } });
      expect(mocks.svc.getBalance).toHaveBeenCalledWith(ORG, 'user-1');

      await actions.getMyWalletLedger({ limit: 5, offset: 2 });
      expect(mocks.svc.listLedger).toHaveBeenCalledWith(ORG, 'user-1', 5, 2);
    });

    it('rejects an unauthenticated caller before it reads anything', async () => {
      mocks.auth.mockResolvedValue({ userId: null });

      expect((await actions.getMyWalletBalance()).success).toBe(false);
      expect((await actions.getMyWalletLedger()).success).toBe(false);
      expect(mocks.contexts).toEqual([]);
    });

    it('reports a database failure instead of a zero balance', async () => {
      mocks.svc.getBalance.mockRejectedValueOnce(new Error('connection lost'));

      const result = await actions.getMyWalletBalance();

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/^Something went wrong\. Please try again\. \(reference [0-9a-f]{8}\)$/);
      expect(result).not.toHaveProperty('data');
    });
  });

  describe('redemptions', () => {
    const redeem = { programId: PROGRAM, creditsToSpend: 10 };

    it('initiates a redemption without Shopify', async () => {
      const result = await actions.initiateRedemption(redeem);

      expect(result.success).toBe(true);
      expect((result as { data: { checkout_url?: string } }).data.checkout_url).toBeUndefined();
      expect(mocks.svc.getProgramById).toHaveBeenCalledWith(PROGRAM, ORG);
      expect(mocks.svc.initiateRedemption).toHaveBeenCalledWith({ orgId: ORG, userId: 'user-1', programId: PROGRAM, creditsToSpend: 10, provider: 'shopify' });
    });

    it('refuses a program that is not the organization own and deducts nothing', async () => {
      mocks.svc.getProgramById.mockResolvedValueOnce(null);

      expect(await actions.initiateRedemption(redeem)).toEqual({ success: false, error: 'Program not found' });
      expect(mocks.svc.initiateRedemption).not.toHaveBeenCalled();
    });

    it('calls Shopify outside any transaction and records the checkout in the organization, as the member', async () => {
      vi.stubEnv('SHOPIFY_ENABLED', 'true');

      const result = await actions.initiateRedemption(redeem);

      expect(result.success).toBe(true);
      expect((result as { data: { checkout_url?: string } }).data.checkout_url).toBe('https://shop/checkout');
      expect(ranIn.createDiscountCode).toBeNull();
      expect(ranIn.createCheckoutSession).toBeNull();
      expect(ranIn.updateRedemptionCheckout).toBe(ORG);
      expect(mocks.svc.updateRedemptionCheckout).toHaveBeenCalledWith(REDEMPTION, ORG, 'DISC', 'https://shop/checkout', 'user-1');
    });

    it('gives the credits back and says nothing was redeemed when Shopify is down', async () => {
      vi.stubEnv('SHOPIFY_ENABLED', 'true');
      mocks.createDiscountCode.mockRejectedValueOnce(new Error('shopify down'));

      const result = await actions.initiateRedemption(redeem);

      expect(result).toEqual({ success: false, error: expect.stringMatching(/nothing was redeemed and your credits were not spent/) });
      expect(mocks.loggerError).toHaveBeenCalled();
      expect(mocks.svc.updateRedemptionCheckout).not.toHaveBeenCalled();
      expect(mocks.svc.cancelRedemption).toHaveBeenCalledWith(REDEMPTION, ORG, 'The store could not create the checkout', { userId: 'user-1', mustOwn: true });
      expect(ranIn.cancelRedemption).toBe(ORG);
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it('never sends the member to an address that is not a checkout on the configured store, and gives the credits back', async () => {
      vi.stubEnv('SHOPIFY_ENABLED', 'true');
      mocks.isStoreCheckoutUrl.mockReturnValueOnce(false);

      const result = await actions.initiateRedemption(redeem);

      expect(result.success).toBe(false);
      expect(result).not.toHaveProperty('data');
      expect(mocks.svc.updateRedemptionCheckout).not.toHaveBeenCalled();
      expect(mocks.svc.cancelRedemption).toHaveBeenCalledTimes(1);
    });

    it('tells the member to contact an administrator, with the redemption, when the credits cannot be given back either', async () => {
      vi.stubEnv('SHOPIFY_ENABLED', 'true');
      mocks.createDiscountCode.mockRejectedValueOnce(new Error('shopify down'));
      mocks.svc.cancelRedemption.mockRejectedValueOnce(new Error('connection lost'));

      const result = await actions.initiateRedemption(redeem);

      expect(result.success).toBe(false);
      expect((result as { error: string }).error).toContain(REDEMPTION);
      expect((result as { error: string }).error).not.toContain('connection lost');
      expect(mocks.loggerError).toHaveBeenCalledTimes(2);
    });

    it('does not touch Shopify, and records the request only, when the store is not enabled', async () => {
      await actions.initiateRedemption(redeem);

      expect(mocks.createDiscountCode).not.toHaveBeenCalled();
      expect(mocks.svc.cancelRedemption).not.toHaveBeenCalled();
    });

    it('rejects an unauthenticated caller', async () => {
      mocks.auth.mockResolvedValueOnce({ userId: null });

      expect((await actions.initiateRedemption(redeem)).success).toBe(false);
      expect(mocks.svc.initiateRedemption).not.toHaveBeenCalled();
    });

    it('lets a member cancel only their own redemption', async () => {
      await actions.cancelRedemption({ redemptionId: REDEMPTION, reason: 'Changed my mind' });

      expect(mocks.svc.cancelRedemption).toHaveBeenCalledWith(REDEMPTION, ORG, 'Changed my mind', { userId: 'user-1', mustOwn: true });
    });

    it('lists the signed-in member own redemptions, and rejects an unauthenticated caller', async () => {
      expect((await actions.listMyRedemptions({ limit: 3 })).success).toBe(true);
      expect(mocks.svc.listUserRedemptions).toHaveBeenCalledWith(ORG, 'user-1', 3, 0);

      mocks.auth.mockResolvedValueOnce({ userId: null });
      expect((await actions.listMyRedemptions()).success).toBe(false);
    });
  });

  describe('reporting', () => {
    it('reads the summary of the administrator organization with its date filters', async () => {
      const result = await actions.getRewardsSummary({
        startDate: '2025-01-01T00:00:00.000Z',
        endDate: '2025-12-31T00:00:00.000Z',
        programId: PROGRAM,
      });

      expect(result).toMatchObject({
        success: true,
        data: { active_programs_count: 1, pending_awards_count: 1, total_credits_issued: 1, total_credits_redeemed: 2, total_credits_outstanding: 3, active_members: 4 },
      });
      expect(mocks.svc.getLedgerSummary).toHaveBeenCalledWith(ORG, new Date('2025-01-01T00:00:00.000Z'), new Date('2025-12-31T00:00:00.000Z'));
      expect(mocks.svc.getBudgetUsageSummary).toHaveBeenCalledWith(ORG, PROGRAM);
      expect(mocks.svc.listAwardsByStatus).toHaveBeenCalledWith(ORG, ['pending']);
    });

    it('reads the summary in one transaction', async () => {
      await actions.getRewardsSummary();

      const summaryContexts = mocks.contexts.filter((context) => context.organizationId === ORG);
      // one context for the administrator check, one for all four reads
      expect(summaryContexts).toHaveLength(2);
    });
  });

  describe('authentication and role resolution', () => {
    it('fails when the organization cannot be resolved', async () => {
      mocks.getOrganizationIdForUser.mockRejectedValueOnce(new Error('User not associated with any organization'));

      const result = await actions.listRecognitionPrograms();

      expect(result.success).toBe(false);
      expect(result.error).not.toContain('not associated');
      expect(mocks.svc.listPrograms).not.toHaveBeenCalled();
    });

    it('tells a caller with no verified membership so, without the resolver text written for the log', async () => {
      mocks.getOrganizationIdForUser.mockRejectedValueOnce(
        Object.assign(new Error('No verified organization membership for user user-1. Set UE_ALLOW_DEFAULT_ORG=true to allow it.'), {
          code: 'ORG_CONTEXT_REQUIRED',
          name: 'OrgContextRequiredError',
        }),
      );

      expect(await actions.listRecognitionPrograms()).toEqual({ success: false, error: 'You do not belong to an organization' });
      expect(mocks.svc.listPrograms).not.toHaveBeenCalled();
    });

    it('fails admin-gated actions when the user has no membership', async () => {
      mocks.members.admin = undefined;

      const result = await actions.createRecognitionProgram({ name: 'x' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not associated');
      expect(mocks.svc.createProgram).not.toHaveBeenCalled();
    });

    it('fails admin-gated actions for a member who is not an administrator', async () => {
      mocks.members.admin = { organizationId: ORG, role: 'member' };

      const result = await actions.createRecognitionProgram({ name: 'x' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient permissions');
      expect(mocks.svc.createProgram).not.toHaveBeenCalled();
    });

    it('fails admin-gated actions when unauthenticated', async () => {
      mocks.auth.mockResolvedValue({ userId: null });

      const result = await actions.createRecognitionProgram({ name: 'x' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized');
    });
  });
});

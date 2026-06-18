import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => {
  const queue: unknown[] = [];
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    const methods = [
      'select', 'from', 'where', 'limit', 'orderBy', 'groupBy',
      'innerJoin', 'leftJoin', 'insert', 'update', 'set', 'values', 'returning', 'delete',
    ];
    for (const m of methods) chain[m] = vi.fn(() => chain);
    (chain as { then: unknown }).then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
      const item = queue.length ? queue.shift() : [];
      if (item instanceof Error) return Promise.reject(item).catch(reject);
      return Promise.resolve(item).then(resolve);
    };
    return chain;
  };
  const db = {
    select: vi.fn(() => makeChain()),
    insert: vi.fn(() => makeChain()),
    update: vi.fn(() => makeChain()),
    delete: vi.fn(() => makeChain()),
  };
  return { queue, db };
});

const pushSel = (...items: unknown[]) => { h.queue.push(...items); };

vi.mock('@/db', () => ({ db: h.db }));
vi.mock('@/db/schema/domains/governance', () => new Proxy({}, {
  has: () => true,
  get: (_t, n) => (n === '__esModule' ? false : new Proxy({}, { get: (_o, c) => ({ __col: c }) })),
}));
vi.mock('drizzle-orm', async (orig) => ({
  ...(await (orig() as Promise<Record<string, unknown>>)),
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  lte: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
}));

import { FounderConflictService } from '../founder-conflict-service';

const S = FounderConflictService;

const enabledPolicy = (over: Record<string, unknown> = {}) => ({
  policyEnabled: true,
  blindTrustRequired: true,
  coveredRoles: ['founder', 'president'],
  disclosureDeadline: '01-31',
  minimumReviewers: '2',
  ...over,
});

beforeEach(() => {
  h.queue.length = 0;
});

describe('founder-conflict-service', () => {
  describe('requiresBlindTrust', () => {
    it('returns false when the policy is disabled', async () => {
      pushSel([enabledPolicy({ policyEnabled: false })]);
      expect(await S.requiresBlindTrust('u1', 'founder')).toBe(false);
    });

    it('returns true for a covered role', async () => {
      pushSel([enabledPolicy()]);
      expect(await S.requiresBlindTrust('u1', 'Founder')).toBe(true);
    });

    it('returns false for an uncovered role', async () => {
      pushSel([enabledPolicy()]);
      expect(await S.requiresBlindTrust('u1', 'member')).toBe(false);
    });

    it('creates a default policy when none exists', async () => {
      pushSel([], [enabledPolicy()]); // getPolicy: select empty, insert returning default
      expect(await S.requiresBlindTrust('u1', 'founder')).toBe(true);
    });
  });

  describe('establishBlindTrust', () => {
    const setup = { userId: 'u1', fullName: 'F', role: 'founder', trusteeName: 'T', trusteeContact: 'c', trusteeRelationship: 'r', trustType: 'discretionary', assetsTransferred: [], estimatedValue: 1000, trustDocument: 'doc' };

    it('throws when the role does not require a blind trust', async () => {
      pushSel([enabledPolicy({ coveredRoles: ['president'] })]);
      await expect(S.establishBlindTrust({ ...setup, role: 'member' })).rejects.toThrow('does not require blind trust');
    });

    it('throws when a trust already exists', async () => {
      pushSel([enabledPolicy()], [{ id: 'existing' }]);
      await expect(S.establishBlindTrust(setup)).rejects.toThrow('already established');
    });

    it('establishes a new blind trust', async () => {
      pushSel([enabledPolicy()], [], [{ id: 't1' }], []);
      const r = await S.establishBlindTrust(setup);
      expect(r).toEqual({ id: 't1' });
    });
  });

  describe('verifyBlindTrust', () => {
    it('marks a compliant trust verified', async () => {
      pushSel([], []);
      await S.verifyBlindTrust('t1', 'admin', true, 'ok');
      expect(h.db.update).toHaveBeenCalled();
    });

    it('marks a non-compliant trust', async () => {
      pushSel([], []);
      await S.verifyBlindTrust('t1', 'admin', false, 'bad');
      expect(h.db.update).toHaveBeenCalled();
    });
  });

  describe('submitDisclosure', () => {
    const disc = { userId: 'u1', fullName: 'F', role: 'founder', disclosureType: 'annual', conflictType: 'financial', conflictDescription: 'd' };

    it('submits an annual disclosure (overdue)', async () => {
      pushSel([enabledPolicy()], [{ id: 'd1' }], []);
      const r = await S.submitDisclosure(disc);
      expect(r).toEqual({ id: 'd1' });
    });

    it('submits an ad-hoc disclosure with significant financial interest', async () => {
      pushSel([enabledPolicy()], [{ id: 'd2' }], []);
      const r = await S.submitDisclosure({ ...disc, disclosureType: 'ad_hoc', financialInterestAmount: 6000, ownershipPercentage: 10 });
      expect(r).toEqual({ id: 'd2' });
    });
  });

  describe('reviewDisclosure', () => {
    it('throws when the disclosure is not found', async () => {
      pushSel([]);
      await expect(S.reviewDisclosure('d1', 'r1', 'approved')).rejects.toThrow('Disclosure not found');
    });

    it('completes the review when the minimum reviewers is met', async () => {
      pushSel([{ reviewedBy: ['r1'] }], [enabledPolicy()], [], []);
      await S.reviewDisclosure('d1', 'r2', 'approved', 'ok');
      expect(h.db.update).toHaveBeenCalled();
    });

    it('keeps the disclosure under review when below the minimum', async () => {
      pushSel([{ reviewedBy: [] }], [enabledPolicy()], [], []);
      await S.reviewDisclosure('d1', 'r1', 'rejected');
      expect(h.db.update).toHaveBeenCalled();
    });
  });

  describe('verifyArmsLength', () => {
    const check = { transactionId: 'tx1', transactionType: 'purchase', transactionAmount: 1000, fromParty: 'p1', toParty: 'p2' };

    it('marks an arms-length transaction when no relationship exists', async () => {
      pushSel([], [], [{ id: 'v1' }]); // disclosures empty, trusts empty, insert
      const r = await S.verifyArmsLength(check);
      expect(r).toEqual({ id: 'v1' });
    });

    it('flags a transaction when a disclosed relationship exists', async () => {
      pushSel(
        [{ userId: 'p1', relatedParties: [{ userId: 'p2' }], conflictType: 'family', conflictDescription: 'd' }],
        [{ id: 'v2' }], // insert verification
        [], // audit log
      );
      const r = await S.verifyArmsLength(check);
      expect(r).toEqual({ id: 'v2' });
    });

    it('flags a transaction when the from-party holds a blind trust', async () => {
      pushSel(
        [], // disclosures empty
        [{ fullName: 'F', role: 'founder' }], // trust record
        [{ id: 'v3' }], // insert
        [], // audit log
      );
      const r = await S.verifyArmsLength(check);
      expect(r).toEqual({ id: 'v3' });
    });
  });

  it('documentRecusal inserts and logs', async () => {
    pushSel([{ id: 'rec1' }], []);
    const r = await S.documentRecusal({ userId: 'u1', fullName: 'F', role: 'founder', recusalType: 'vote', recusalReason: 'conflict', documentedBy: 'admin' });
    expect(r).toEqual({ id: 'rec1' });
  });

  it('getOverdueDisclosures returns overdue rows', async () => {
    pushSel([{ id: 'd1' }]);
    expect(await S.getOverdueDisclosures()).toEqual([{ id: 'd1' }]);
  });

  it('getNonCompliantTrusts returns non-compliant trusts', async () => {
    pushSel([{ id: 't1' }]);
    expect(await S.getNonCompliantTrusts()).toEqual([{ id: 't1' }]);
  });

  it('getUserDisclosures returns a user disclosures', async () => {
    pushSel([{ id: 'd1' }]);
    expect(await S.getUserDisclosures('u1')).toEqual([{ id: 'd1' }]);
  });

  describe('getUserBlindTrust', () => {
    it('returns the trust when found', async () => {
      pushSel([{ id: 't1' }]);
      expect(await S.getUserBlindTrust('u1')).toEqual({ id: 't1' });
    });

    it('returns null when none exists', async () => {
      pushSel([]);
      expect(await S.getUserBlindTrust('u1')).toBeNull();
    });
  });
});

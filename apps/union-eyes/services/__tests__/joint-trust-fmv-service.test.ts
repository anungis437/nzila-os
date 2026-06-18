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
vi.mock('@/db/schema/joint-trust-fmv-schema', () => new Proxy({}, {
  has: () => true,
  get: (_t, n) => (n === '__esModule' ? false : new Proxy({}, { get: (_o, c) => ({ __col: c }) })),
}));
vi.mock('drizzle-orm', async (orig) => ({
  ...(await (orig() as Promise<Record<string, unknown>>)),
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  lte: vi.fn(() => ({})),
  gte: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
}));

import { JointTrustFMVService } from '../joint-trust-fmv-service';

const S = JointTrustFMVService;
const policy = () => ({ policyEnabled: true });

beforeEach(() => {
  h.queue.length = 0;
});

describe('joint-trust-fmv-service', () => {
  it('createFMVBenchmark inserts a benchmark and audits', async () => {
    pushSel([{ id: 'bm1' }], []);
    const r = await S.createFMVBenchmark(
      { itemCategory: 'office', itemDescription: 'desk', fmvLow: 100, fmvHigh: 300, fmvMedian: 200, region: 'national' },
      'admin',
    );
    expect(r).toEqual({ id: 'bm1' });
  });

  describe('getFMVBenchmark', () => {
    it('returns a matching benchmark', async () => {
      pushSel([{ id: 'bm1', fmvMedian: '200' }]);
      const r = await S.getFMVBenchmark('office', 'national');
      expect(r).toEqual({ id: 'bm1', fmvMedian: '200' });
    });

    it('returns null when none match', async () => {
      pushSel([]);
      expect(await S.getFMVBenchmark('office', 'national')).toBeNull();
    });
  });

  it('importCPIData inserts CPI data and audits', async () => {
    pushSel([{ id: 'cpi1' }], []);
    const r = await S.importCPIData('2025', '3', 165.4, 'admin');
    expect(r).toEqual({ id: 'cpi1' });
  });

  describe('adjustPriceForCPI', () => {
    const params = { itemId: 'i1', itemDescription: 'd', originalPrice: 1000, originalPriceDate: new Date('2020-01-01'), approvedBy: 'admin' };

    it('throws without original CPI', async () => {
      pushSel([]); // getCPIForDate empty
      await expect(S.adjustPriceForCPI(params)).rejects.toThrow('Original CPI');
    });

    it('throws without current CPI', async () => {
      pushSel([{ cpiValue: '150.0' }], []); // original found, current empty
      await expect(S.adjustPriceForCPI(params)).rejects.toThrow('Current CPI');
    });

    it('records a CPI-adjusted price', async () => {
      pushSel([{ cpiValue: '150.0' }], [{ cpiValue: '165.0' }], [{ id: 'adj1' }], []);
      const r = await S.adjustPriceForCPI(params);
      expect(r).toEqual({ id: 'adj1' });
    });
  });

  describe('createProcurementRequest', () => {
    it('creates a sole-source request below the bidding threshold', async () => {
      pushSel([policy()], [{ id: 'pr1' }], []); // getPolicy, insert, audit
      const r = await S.createProcurementRequest({
        requestTitle: 't', requestDescription: 'd', estimatedValue: 5000, procurementType: 'goods', requestedBy: 'u1',
      });
      expect(r).toEqual({ id: 'pr1' });
    });

    it('creates a competitive request requiring appraisal above the threshold', async () => {
      pushSel([], [policy()], [{ id: 'pr2' }], [], []); // getPolicy default-create, insert, appraisal-audit, audit
      const r = await S.createProcurementRequest({
        requestTitle: 't', requestDescription: 'd', estimatedValue: 60000, procurementType: 'goods', requestedBy: 'u1',
      });
      expect(r).toEqual({ id: 'pr2' });
    });
  });

  describe('submitBid', () => {
    const bid = { procurementRequestId: 'pr1', bidderName: 'Acme', bidderContact: 'a@x.com', bidAmount: 200 };

    it('throws when the request is not found', async () => {
      pushSel([]);
      await expect(S.submitBid(bid)).rejects.toThrow('not found');
    });

    it('throws when bidding is closed', async () => {
      pushSel([{ id: 'pr1', status: 'closed' }]);
      await expect(S.submitBid(bid)).rejects.toThrow('bidding is closed');
    });

    it('throws when the deadline has passed', async () => {
      pushSel([{ id: 'pr1', status: 'open_bidding', biddingDeadline: new Date('2000-01-01') }]);
      await expect(S.submitBid(bid)).rejects.toThrow('deadline has passed');
    });

    it('submits a bid with a matching FMV benchmark', async () => {
      pushSel(
        [{ id: 'pr1', status: 'open_bidding', procurementType: 'goods', bidsReceived: '0', minimumBidsRequired: '3' }], // request
        [{ id: 'bm1', fmvLow: '100', fmvHigh: '300', fmvMedian: '200' }], // getFMVBenchmark
        [{ id: 'bid1' }], // insert bid
        [], // update count
        [], // audit
      );
      const r = await S.submitBid(bid);
      expect(r).toEqual({ id: 'bid1' });
    });

    it('submits a bid without an FMV benchmark', async () => {
      pushSel(
        [{ id: 'pr1', status: 'open_bidding', procurementType: 'goods', bidsReceived: '1', minimumBidsRequired: '3' }],
        [], // no benchmark
        [{ id: 'bid2' }],
        [],
        [],
      );
      const r = await S.submitBid(bid);
      expect(r).toEqual({ id: 'bid2' });
    });
  });

  describe('verify3BidCompliance', () => {
    it('throws when the request is not found', async () => {
      pushSel([]);
      await expect(S.verify3BidCompliance('pr1')).rejects.toThrow('not found');
    });

    it('is compliant for a low-value request', async () => {
      pushSel([{ id: 'pr1', estimatedValue: '5000', minimumBidsRequired: '1', bidsReceived: '1' }]);
      const r = await S.verify3BidCompliance('pr1');
      expect(r.compliant).toBe(true);
    });

    it('flags insufficient bids and missing appraisal', async () => {
      pushSel(
        [{ id: 'pr1', estimatedValue: '60000', minimumBidsRequired: '3', bidsReceived: '1' }], // request
        [], // logViolation insufficient bids insert
        [], // appraisals select empty
        [], // logViolation no appraisal insert
      );
      const r = await S.verify3BidCompliance('pr1');
      expect(r.compliant).toBe(false);
      expect(r.violations).toHaveLength(2);
    });

    it('is compliant when bids and appraisal exist', async () => {
      pushSel(
        [{ id: 'pr1', estimatedValue: '60000', minimumBidsRequired: '3', bidsReceived: '3' }],
        [{ id: 'ap1' }], // appraisals exist
      );
      const r = await S.verify3BidCompliance('pr1');
      expect(r.compliant).toBe(true);
    });
  });

  it('requestIndependentAppraisal inserts and audits', async () => {
    pushSel([{ id: 'ap1' }], []);
    const r = await S.requestIndependentAppraisal({
      itemType: 'equipment', itemDescription: 'd', appraiserName: 'A', appraiserCompany: 'Co', requestedBy: 'u1',
    });
    expect(r).toEqual({ id: 'ap1' });
  });

  describe('getViolations', () => {
    it('filters by status', async () => {
      pushSel([{ id: 'v1' }]);
      expect(await S.getViolations('pending')).toEqual([{ id: 'v1' }]);
    });

    it('returns all violations without a status', async () => {
      pushSel([{ id: 'v1' }, { id: 'v2' }]);
      expect(await S.getViolations()).toHaveLength(2);
    });
  });
});

import { describe, it, expect } from 'vitest';

import {
  calculateRegionalCosts,
  compareTiers,
  computeQuote,
  DEFAULT_COST_ASSUMPTIONS,
  evaluateDiscounts,
  projectRevenue,
  resolveTier,
  totalFixedCosts,
} from '../pricing-calculator';

describe('platform-economics/pricing-calculator', () => {
  describe('totalFixedCosts', () => {
    it('sums the fixed cost components', () => {
      expect(totalFixedCosts()).toBe(
        DEFAULT_COST_ASSUMPTIONS.cloudHostingBase +
          DEFAULT_COST_ASSUMPTIONS.engineeringTeam +
          DEFAULT_COST_ASSUMPTIONS.productDesign +
          DEFAULT_COST_ASSUMPTIONS.customerSuccess +
          DEFAULT_COST_ASSUMPTIONS.salesMarketing +
          DEFAULT_COST_ASSUMPTIONS.legalCompliance +
          DEFAULT_COST_ASSUMPTIONS.adminOverhead,
      );
    });
  });

  describe('resolveTier', () => {
    it('resolves within a band', () => {
      expect(resolveTier(1_000).tier).toBe('starter');
      expect(resolveTier(5_000).tier).toBe('professional');
      expect(resolveTier(60_000).tier).toBe('enterprise');
    });

    it('falls back to starter below the minimum band', () => {
      expect(resolveTier(50).tier).toBe('starter');
    });
  });

  describe('evaluateDiscounts', () => {
    it('includes a contract-term discount when the term qualifies', () => {
      const result = evaluateDiscounts(1_000, 36);
      expect(result.some((r) => r.type === 'contract_term')).toBe(true);
    });

    it('excludes volume discount below the threshold', () => {
      const result = evaluateDiscounts(1_000, 12);
      expect(result.some((r) => r.type === 'volume')).toBe(false);
    });

    it('includes a volume discount above the threshold and custom discounts', () => {
      const result = evaluateDiscounts(60_000, 12, [
        { type: 'custom', name: 'Special', ratePercent: 5, appliesTo: 'total' },
      ]);
      expect(result.some((r) => r.type === 'volume')).toBe(true);
      expect(result.some((r) => r.type === 'custom')).toBe(true);
    });
  });

  describe('calculateRegionalCosts', () => {
    it('returns null when no regions are specified', () => {
      expect(calculateRegionalCosts()).toBeNull();
    });

    it('selects regions by code', () => {
      const result = calculateRegionalCosts(['on', 'qc']);
      expect(result?.regions).toHaveLength(2);
      expect(result?.totalImplementation).toBeGreaterThan(0);
    });

    it('selects the first N regions by count', () => {
      const result = calculateRegionalCosts(undefined, 3);
      expect(result?.regions).toHaveLength(3);
    });

    it('returns null when codes match no region', () => {
      expect(calculateRegionalCosts(['zz'])).toBeNull();
    });
  });

  describe('computeQuote', () => {
    it('computes a basic quote', () => {
      const q = computeQuote({ memberCount: 1_000 });
      expect(q.tier.tier).toBe('starter');
      expect(q.grossRevenue).toBe(q.baseFeeAnnual + q.perMemberRevenue);
      expect(q.currency).toBe('CAD');
    });

    it('applies escalator for contract year > 1', () => {
      const q = computeQuote({ memberCount: 1_000, contractYear: 2 });
      expect(q.escalatorPercent).toBe(3);
      expect(q.escalatorAmount).toBeGreaterThan(0);
    });

    it('applies all discount appliesTo branches', () => {
      const q = computeQuote({
        memberCount: 60_000, // qualifies volume (per_member)
        contractTermMonths: 36, // qualifies contract_term (total)
        regions: ['ON'],
        customDiscounts: [{ type: 'custom', name: 'BaseCut', ratePercent: 5, appliesTo: 'base_fee' }],
      });
      expect(q.discounts.length).toBeGreaterThanOrEqual(3);
      expect(q.totalDiscount).toBeGreaterThan(0);
      expect(q.implementationFees).toBeGreaterThan(0);
    });

    it('honours an explicit tier override', () => {
      const q = computeQuote({ memberCount: 1_000, tier: 'enterprise' });
      expect(q.tier.tier).toBe('enterprise');
    });

    it('throws on invalid inputs', () => {
      expect(() => computeQuote({ memberCount: 0 })).toThrow('memberCount');
      expect(() => computeQuote({ memberCount: 10, contractTermMonths: 0 })).toThrow('contractTermMonths');
      expect(() => computeQuote({ memberCount: 10, contractYear: 0 })).toThrow('contractYear');
    });

    it('handles a zero contribution margin per member (Infinity breakeven)', () => {
      const q = computeQuote(
        { memberCount: 1_000 },
        { ...DEFAULT_COST_ASSUMPTIONS, variableCostPerMemberMonth: 1_000 },
      );
      expect(q.breakeven.membersForOneCient).toBe(Infinity);
    });
  });

  describe('projectRevenue', () => {
    it('projects multiple years', () => {
      const projections = projectRevenue({ memberCount: 1_000, regions: ['ON'] }, 3);
      expect(projections).toHaveLength(3);
      expect(projections[0]!.implementationFees).toBeGreaterThan(0);
      expect(projections[1]!.implementationFees).toBe(0);
    });
  });

  describe('compareTiers', () => {
    it('compares all tiers with region fees', () => {
      const result = compareTiers(1_000, 2);
      expect(result).toHaveLength(4);
      expect(result[0]!.implementationFee).toBe(10_000);
    });
  });
});

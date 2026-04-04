/**
 * Pricing Calculator — Test Suite
 *
 * Validates the GTM pricing engine against the Draft Pricing Model.xlsx
 * spreadsheet values. Covers:
 *  - Tier resolution from member count
 *  - Revenue calculation (base + per-member)
 *  - Discount evaluation (volume, contract-term, stacking)
 *  - Regional deployment cost model
 *  - Escalator (3% annual)
 *  - Breakeven analysis (1/3/5 clients)
 *  - Multi-year projections
 *  - Tier comparison matrix
 *  - Edge cases (boundaries, minimum, large counts)
 */
import { describe, it, expect } from 'vitest';
import {
  GTM_TIERS,
  GTM_DISCOUNTS,
  DEFAULT_COST_ASSUMPTIONS,
  CANADA_REGIONS,
  resolveTier,
  evaluateDiscounts,
  calculateRegionalCosts,
  computeQuote,
  projectRevenue,
  compareTiers,
  totalFixedCosts,
} from './pricing-calculator';

// ============================================================================
// Tier Resolution
// ============================================================================

describe('resolveTier', () => {
  it('resolves Starter for 200 members', () => {
    expect(resolveTier(200).tier).toBe('starter');
  });

  it('resolves Starter for 2,000 members (upper bound)', () => {
    expect(resolveTier(2_000).tier).toBe('starter');
  });

  it('resolves Professional for 2,001 members', () => {
    expect(resolveTier(2_001).tier).toBe('professional');
  });

  it('resolves Professional for 15,000 members', () => {
    expect(resolveTier(15_000).tier).toBe('professional');
  });

  it('resolves Premium for 15,001 members', () => {
    expect(resolveTier(15_001).tier).toBe('premium');
  });

  it('resolves Premium for 50,000 members', () => {
    expect(resolveTier(50_000).tier).toBe('premium');
  });

  it('resolves Enterprise for 50,001 members', () => {
    expect(resolveTier(50_001).tier).toBe('enterprise');
  });

  it('resolves Enterprise for 100,000 members', () => {
    expect(resolveTier(100_000).tier).toBe('enterprise');
  });

  it('falls back to Starter for counts below minimum band', () => {
    expect(resolveTier(50).tier).toBe('starter');
  });

  it('falls back to Enterprise for very large counts', () => {
    expect(resolveTier(1_000_000).tier).toBe('enterprise');
  });
});

// ============================================================================
// Revenue Calculations — Excel "Tier Pricing" sheet validation
// ============================================================================

describe('computeQuote — revenue matches Excel', () => {
  it('Small Local: 200 members, Starter = $35,800', () => {
    const q = computeQuote({ memberCount: 200, tier: 'starter' });
    // $25,000 base + (200 × $54) = $25,000 + $10,800 = $35,800
    expect(q.grossRevenue).toBe(35_800);
  });

  it('Mid Local: 2,000 members, Starter = $133,000', () => {
    const q = computeQuote({ memberCount: 2_000, tier: 'starter' });
    expect(q.grossRevenue).toBe(133_000);
  });

  it('Regional: 10,000 members, Professional = $475,000', () => {
    const q = computeQuote({ memberCount: 10_000, tier: 'professional' });
    expect(q.grossRevenue).toBe(475_000);
  });

  it('Mid National: 25,000 members, Premium = $910,000', () => {
    const q = computeQuote({ memberCount: 25_000, tier: 'premium' });
    expect(q.grossRevenue).toBe(910_000);
  });

  it('Large National: 50,000 members, Enterprise = $1,375,000', () => {
    const q = computeQuote({ memberCount: 50_000, tier: 'enterprise' });
    expect(q.grossRevenue).toBe(1_375_000);
  });

  it('Mega National: 100,000 members, Enterprise = $2,725,000', () => {
    const q = computeQuote({ memberCount: 100_000, tier: 'enterprise' });
    expect(q.grossRevenue).toBe(2_725_000);
  });

  it('all tiers render $25,000 base fee', () => {
    for (const tierDef of GTM_TIERS) {
      const q = computeQuote({ memberCount: 1_000, tier: tierDef.tier });
      expect(q.baseFeeAnnual).toBe(25_000);
    }
  });
});

// ============================================================================
// Discount Evaluation
// ============================================================================

describe('evaluateDiscounts', () => {
  it('no discounts for small union with 12-month contract', () => {
    const discounts = evaluateDiscounts(5_000, 12);
    expect(discounts).toHaveLength(0);
  });

  it('volume discount applies at 50,000+ members', () => {
    const discounts = evaluateDiscounts(50_000, 12);
    expect(discounts).toHaveLength(1);
    expect(discounts[0].type).toBe('volume');
    expect(discounts[0].ratePercent).toBe(15.0);
  });

  it('contract-term discount applies at 36+ months', () => {
    const discounts = evaluateDiscounts(5_000, 36);
    expect(discounts).toHaveLength(1);
    expect(discounts[0].type).toBe('contract_term');
    expect(discounts[0].ratePercent).toBe(10.0);
  });

  it('both discounts stack for large union with 3-year contract', () => {
    const discounts = evaluateDiscounts(75_000, 36);
    expect(discounts).toHaveLength(2);
    const types = discounts.map(d => d.type);
    expect(types).toContain('volume');
    expect(types).toContain('contract_term');
  });

  it('custom discounts are included', () => {
    const custom = [{
      type: 'early_adopter' as const,
      name: 'Early Bird',
      ratePercent: 5,
      appliesTo: 'total' as const,
    }];
    const discounts = evaluateDiscounts(1_000, 12, custom);
    expect(discounts).toHaveLength(1);
    expect(discounts[0].name).toBe('Early Bird');
  });
});

// ============================================================================
// Discount Application in Quotes
// ============================================================================

describe('computeQuote — discounts', () => {
  it('volume discount reduces per-member revenue by 15%', () => {
    const q = computeQuote({ memberCount: 75_000, tier: 'enterprise' });
    // 75K × $27/yr = $2,025,000 per-member revenue
    // 15% of $2,025,000 = $303,750
    expect(q.discounts).toHaveLength(1);
    expect(q.discounts[0].savingsAmount).toBe(303_750);
    expect(q.totalDiscount).toBe(303_750);
  });

  it('3-year contract discount reduces total by 10%', () => {
    const q = computeQuote({ memberCount: 5_000, tier: 'professional', contractTermMonths: 36 });
    // Gross = $25,000 + (5,000 × $45) = $250,000
    // 10% of $250,000 = $25,000
    expect(q.discounts).toHaveLength(1);
    expect(q.discounts[0].savingsAmount).toBe(25_000);
    expect(q.netRevenue).toBe(225_000);
  });

  it('stacked discounts apply correctly', () => {
    const q = computeQuote({ memberCount: 75_000, tier: 'enterprise', contractTermMonths: 36 });
    // Gross = $25,000 + (75,000 × $27) = $2,050,000
    // Volume: 15% of per-member ($2,025,000) = $303,750
    // Contract: 10% of total ($2,050,000) = $205,000
    // Total discount = $508,750
    expect(q.discounts).toHaveLength(2);
    expect(q.totalDiscount).toBe(508_750);
    expect(q.netRevenue).toBe(2_050_000 - 508_750);
  });
});

// ============================================================================
// Escalator
// ============================================================================

describe('computeQuote — annual escalator', () => {
  it('no escalator in year 1', () => {
    const q = computeQuote({ memberCount: 10_000, tier: 'professional', contractYear: 1 });
    expect(q.escalatorPercent).toBe(0);
    expect(q.escalatorAmount).toBe(0);
  });

  it('3% escalator in year 2', () => {
    const q1 = computeQuote({ memberCount: 10_000, tier: 'professional', contractYear: 1 });
    const q2 = computeQuote({ memberCount: 10_000, tier: 'professional', contractYear: 2 });
    expect(q2.escalatorPercent).toBe(3);
    const expected = q1.grossRevenue * 0.03;
    expect(q2.escalatorAmount).toBeCloseTo(expected, 2);
  });

  it('year 3 compounds (1.03²)', () => {
    const q1 = computeQuote({ memberCount: 10_000, tier: 'professional', contractYear: 1 });
    const q3 = computeQuote({ memberCount: 10_000, tier: 'professional', contractYear: 3 });
    const expected = q1.grossRevenue * (Math.pow(1.03, 2) - 1);
    expect(q3.escalatorAmount).toBeCloseTo(expected, 0);
  });
});

// ============================================================================
// Regional Deployment Costs — Excel "Regional Deploy" sheet
// ============================================================================

describe('calculateRegionalCosts', () => {
  it('returns null when no regions specified', () => {
    expect(calculateRegionalCosts()).toBeNull();
    expect(calculateRegionalCosts([])).toBeNull();
  });

  it('Ontario: Year 1 = $16,000, Year 2+ = $11,000', () => {
    const costs = calculateRegionalCosts(['ON']);
    expect(costs).not.toBeNull();
    // $5,000 impl + $8,000 support + $3,000 hosting = $16,000
    expect(costs!.totalYear1).toBe(16_000);
    expect(costs!.totalYear2Plus).toBe(11_000);
  });

  it('Quebec: Year 1 = $13,000, Year 2+ = $8,000', () => {
    const costs = calculateRegionalCosts(['QC']);
    expect(costs).not.toBeNull();
    expect(costs!.totalYear1).toBe(13_000);
    expect(costs!.totalYear2Plus).toBe(8_000);
  });

  it('All 11 regions: impl = $55,000, Year 1 = $102,875', () => {
    const allCodes = CANADA_REGIONS.map(r => r.regionCode);
    const costs = calculateRegionalCosts(allCodes);
    expect(costs).not.toBeNull();
    expect(costs!.totalImplementation).toBe(55_000);
    expect(costs!.totalYear1).toBe(102_875);
    expect(costs!.totalYear2Plus).toBe(47_875);
  });

  it('regionCount selects first N regions', () => {
    const costs = calculateRegionalCosts(undefined, 3);
    expect(costs).not.toBeNull();
    expect(costs!.regions).toHaveLength(3);
  });
});

// ============================================================================
// Breakeven Analysis — Excel "Breakeven" sheet
// ============================================================================

describe('computeQuote — breakeven', () => {
  it('total fixed costs = $978,000', () => {
    expect(totalFixedCosts()).toBe(978_000);
  });

  it('Starter breakeven (1 client) = 18,257 members', () => {
    const q = computeQuote({ memberCount: 1_000, tier: 'starter' });
    // ($978,000 - $25,000) / $52.20 = 18,256.7 → ceil = 18,257
    expect(q.breakeven.membersForOneCient).toBe(18_257);
  });

  it('Professional breakeven (1 client) = 22,061 members', () => {
    const q = computeQuote({ memberCount: 1_000, tier: 'professional' });
    // ($978,000 - $25,000) / $43.20 = 22,060.2 → ceil = 22,061
    expect(q.breakeven.membersForOneCient).toBe(22_061);
  });

  it('Premium breakeven (1 client) = 28,364 members', () => {
    const q = computeQuote({ memberCount: 1_000, tier: 'premium' });
    // ($978,000 - $25,000) / $33.60 = 28,363.1 → ceil = 28,364
    expect(q.breakeven.membersForOneCient).toBe(28_364);
  });

  it('Enterprise breakeven (1 client) = 37,818 members', () => {
    const q = computeQuote({ memberCount: 1_000, tier: 'enterprise' });
    // ($978,000 - $25,000) / $25.20 = 37,817.5 → ceil = 37,818
    expect(q.breakeven.membersForOneCient).toBe(37_818);
  });

  it('breakeven decreases with more clients', () => {
    const q = computeQuote({ memberCount: 1_000, tier: 'starter' });
    expect(q.breakeven.membersForThreeClients).toBeLessThan(q.breakeven.membersForOneCient);
    expect(q.breakeven.membersForFiveClients).toBeLessThan(q.breakeven.membersForThreeClients);
  });
});

// ============================================================================
// Cost Model
// ============================================================================

describe('computeQuote — cost model', () => {
  it('variable cost = $0.15/member/month × 12', () => {
    const q = computeQuote({ memberCount: 10_000 });
    // 10,000 × $0.15 × 12 = $18,000
    expect(q.variableCostAnnual).toBe(18_000);
  });

  it('contribution margin = netRevenue - variableCost', () => {
    const q = computeQuote({ memberCount: 10_000, tier: 'professional' });
    expect(q.contributionMargin).toBe(q.netRevenue - q.variableCostAnnual);
  });

  it('contribution margin percent is positive for viable scenarios', () => {
    const q = computeQuote({ memberCount: 2_000, tier: 'starter' });
    expect(q.contributionMarginPercent).toBeGreaterThan(90); // SaaS-grade margin
  });
});

// ============================================================================
// Multi-Year Revenue Projections
// ============================================================================

describe('projectRevenue', () => {
  it('returns correct number of years', () => {
    const proj = projectRevenue({ memberCount: 10_000, tier: 'professional' }, 3);
    expect(proj).toHaveLength(3);
  });

  it('year 1 revenue matches computeQuote', () => {
    const q = computeQuote({ memberCount: 10_000, tier: 'professional' });
    const proj = projectRevenue({ memberCount: 10_000, tier: 'professional' }, 3);
    expect(proj[0].netRevenue).toBe(q.netRevenue);
  });

  it('implementation fees only in year 1', () => {
    const proj = projectRevenue({ memberCount: 10_000, tier: 'professional', regionCount: 3 }, 3);
    expect(proj[0].implementationFees).toBeGreaterThan(0);
    expect(proj[1].implementationFees).toBe(0);
    expect(proj[2].implementationFees).toBe(0);
  });

  it('revenue grows each year (escalator)', () => {
    const proj = projectRevenue({ memberCount: 10_000, tier: 'professional' }, 3);
    expect(proj[1].grossRevenue).toBeGreaterThan(proj[0].grossRevenue);
    expect(proj[2].grossRevenue).toBeGreaterThan(proj[1].grossRevenue);
  });
});

// ============================================================================
// Tier Comparison Matrix
// ============================================================================

describe('compareTiers', () => {
  it('returns all 4 tiers', () => {
    const cmp = compareTiers(10_000);
    expect(cmp).toHaveLength(4);
    expect(cmp.map(c => c.tier)).toEqual(['starter', 'professional', 'premium', 'enterprise']);
  });

  it('Starter revenue > Enterprise revenue for same member count', () => {
    const cmp = compareTiers(10_000);
    const starter = cmp.find(c => c.tier === 'starter')!;
    const enterprise = cmp.find(c => c.tier === 'enterprise')!;
    expect(starter.annualRevenue).toBeGreaterThan(enterprise.annualRevenue);
  });

  it('10K members: Starter=$565,000, Professional=$475,000, Premium=$379,000, Enterprise=$295,000', () => {
    const cmp = compareTiers(10_000);
    expect(cmp[0].annualRevenue).toBe(565_000);  // Starter
    expect(cmp[1].annualRevenue).toBe(475_000);  // Professional
    expect(cmp[2].annualRevenue).toBe(379_000);  // Premium
    expect(cmp[3].annualRevenue).toBe(295_000);  // Enterprise
  });

  it('implementation fee = regionCount × $5,000', () => {
    const cmp = compareTiers(10_000, 10);
    for (const tier of cmp) {
      expect(tier.implementationFee).toBe(50_000);
    }
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('edge cases', () => {
  it('throws on memberCount < 1', () => {
    expect(() => computeQuote({ memberCount: 0 })).toThrow('memberCount must be ≥ 1');
  });

  it('throws on contractTermMonths < 1', () => {
    expect(() => computeQuote({ memberCount: 100, contractTermMonths: 0 })).toThrow('contractTermMonths must be ≥ 1');
  });

  it('throws on contractYear < 1', () => {
    expect(() => computeQuote({ memberCount: 100, contractYear: 0 })).toThrow('contractYear must be ≥ 1');
  });

  it('tier override works even outside natural band', () => {
    const q = computeQuote({ memberCount: 500, tier: 'enterprise' });
    expect(q.tier.tier).toBe('enterprise');
    expect(q.perMemberAnnual).toBe(27.00);
  });

  it('1 member produces valid quote', () => {
    const q = computeQuote({ memberCount: 1 });
    expect(q.grossRevenue).toBe(25_054); // $25,000 + $54
    expect(q.currency).toBe('CAD');
  });

  it('quote always returns currency = CAD', () => {
    const q = computeQuote({ memberCount: 1_000 });
    expect(q.currency).toBe('CAD');
  });

  it('generatedAt is a valid ISO date', () => {
    const q = computeQuote({ memberCount: 1_000 });
    expect(() => new Date(q.generatedAt)).not.toThrow();
    expect(new Date(q.generatedAt).toISOString()).toBe(q.generatedAt);
  });

  it('regional costs with invalid codes returns null', () => {
    const costs = calculateRegionalCosts(['XX', 'ZZ']);
    expect(costs).toBeNull();
  });
});

// ============================================================================
// Revenue Sensitivity — Excel "Breakeven" sheet cross-check
// ============================================================================

describe('revenue sensitivity — matches Excel', () => {
  const scenarios = [
    { members: 200,     starter: 35_800,    professional: 34_000,   premium: 32_080,   enterprise: 30_400 },
    { members: 500,     starter: 52_000,    professional: 47_500,   premium: 42_700,   enterprise: 38_500 },
    { members: 1_000,   starter: 79_000,    professional: 70_000,   premium: 60_400,   enterprise: 52_000 },
    { members: 2_000,   starter: 133_000,   professional: 115_000,  premium: 95_800,   enterprise: 79_000 },
    { members: 5_000,   starter: 295_000,   professional: 250_000,  premium: 202_000,  enterprise: 160_000 },
    { members: 10_000,  starter: 565_000,   professional: 475_000,  premium: 379_000,  enterprise: 295_000 },
    { members: 15_000,  starter: 835_000,   professional: 700_000,  premium: 556_000,  enterprise: 430_000 },
    { members: 25_000,  starter: 1_375_000, professional: 1_150_000, premium: 910_000,  enterprise: 700_000 },
    { members: 50_000,  starter: 2_725_000, professional: 2_275_000, premium: 1_795_000, enterprise: 1_375_000 },
    { members: 75_000,  starter: 4_075_000, professional: 3_400_000, premium: 2_680_000, enterprise: 2_050_000 },
    { members: 100_000, starter: 5_425_000, professional: 4_525_000, premium: 3_565_000, enterprise: 2_725_000 },
  ];

  for (const s of scenarios) {
    it(`${s.members.toLocaleString()} members — all 4 tiers`, () => {
      const cmp = compareTiers(s.members);
      expect(cmp[0].annualRevenue).toBe(s.starter);
      expect(cmp[1].annualRevenue).toBe(s.professional);
      expect(cmp[2].annualRevenue).toBe(s.premium);
      expect(cmp[3].annualRevenue).toBe(s.enterprise);
    });
  }
});

// ============================================================================
// Constants Integrity
// ============================================================================

describe('constants integrity', () => {
  it('GTM_TIERS has exactly 4 tiers', () => {
    expect(GTM_TIERS).toHaveLength(4);
  });

  it('tier bands are contiguous', () => {
    for (let i = 1; i < GTM_TIERS.length; i++) {
      const prev = GTM_TIERS[i - 1];
      const curr = GTM_TIERS[i];
      expect(curr.memberBandMin).toBe((prev.memberBandMax ?? 0) + 1);
    }
  });

  it('per-member price decreases with tier', () => {
    for (let i = 1; i < GTM_TIERS.length; i++) {
      expect(GTM_TIERS[i].perMemberMonthly).toBeLessThan(GTM_TIERS[i - 1].perMemberMonthly);
    }
  });

  it('perMemberAnnual = perMemberMonthly × 12', () => {
    for (const tier of GTM_TIERS) {
      expect(tier.perMemberAnnual).toBeCloseTo(tier.perMemberMonthly * 12, 2);
    }
  });

  it('GTM_DISCOUNTS has 2 canonical rules', () => {
    expect(GTM_DISCOUNTS).toHaveLength(2);
  });

  it('CANADA_REGIONS has 11 provinces/territories', () => {
    expect(CANADA_REGIONS).toHaveLength(11);
  });

  it('DEFAULT_COST_ASSUMPTIONS variable cost = $0.15', () => {
    expect(DEFAULT_COST_ASSUMPTIONS.variableCostPerMemberMonth).toBe(0.15);
  });
});

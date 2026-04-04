/**
 * Pricing Calculator
 *
 * Pure, deterministic engine that computes pricing quotes from
 * GTM commercial model parameters. All values in CAD.
 *
 * Aligned with: docs/plans/go-to-market/Draft Pricing Model.xlsx
 *
 * Model structure:
 *   Revenue = (National Base Fee) + (Per-Member Fee × Members × 12)
 *            + (Implementation Fee × Regions) + (Regional Deployment Costs)
 *            − Discounts (volume, contract-term, stackable)
 *
 * Variable cost:  variableCostPerMember × members × 12
 * Contribution:   Revenue − Variable Costs
 * Breakeven:      fixedCosts / contributionMarginPerMember
 *
 * @domain platform-economics
 * @layer 1 — Platform Billing (Calculator)
 */

import type { GtmTier } from '@/db/schema/domains/finance/pricing-templates';

// ============================================================================
// Canonical GTM Tier Definitions (aligned with Excel model)
// ============================================================================

export interface GtmTierDefinition {
  tier: GtmTier;
  label: string;
  memberBandMin: number;
  memberBandMax: number | null; // null = unlimited
  perMemberMonthly: number;     // CAD $/member/month
  perMemberAnnual: number;      // CAD $/member/year
  baseFeeAnnual: number;        // CAD national license base fee /year
  featuresIncluded: string;
}

/**
 * Canonical tier definitions — single source of truth.
 * Matches "Tier Pricing" sheet in Draft Pricing Model.xlsx.
 */
export const GTM_TIERS: readonly GtmTierDefinition[] = [
  {
    tier: 'starter',
    label: 'Starter',
    memberBandMin: 200,
    memberBandMax: 2_000,
    perMemberMonthly: 4.50,
    perMemberAnnual: 54.00,
    baseFeeAnnual: 25_000,
    featuresIncluded: 'Core: grievances, membership, dues, basic reports, voting',
  },
  {
    tier: 'professional',
    label: 'Professional',
    memberBandMin: 2_001,
    memberBandMax: 15_000,
    perMemberMonthly: 3.75,
    perMemberAnnual: 45.00,
    baseFeeAnnual: 25_000,
    featuresIncluded: 'All Starter + comms, scheduling, doc storage, analytics, voting',
  },
  {
    tier: 'premium',
    label: 'Premium',
    memberBandMin: 15_001,
    memberBandMax: 50_000,
    perMemberMonthly: 2.95,
    perMemberAnnual: 35.40,
    baseFeeAnnual: 25_000,
    featuresIncluded: 'All Pro + advanced analytics, API, custom workflows, voting',
  },
  {
    tier: 'enterprise',
    label: 'Enterprise',
    memberBandMin: 50_001,
    memberBandMax: null,
    perMemberMonthly: 2.25,
    perMemberAnnual: 27.00,
    baseFeeAnnual: 25_000,
    featuresIncluded: 'All Premium + dedicated support, SLA, custom dev, white-label',
  },
] as const;

// ============================================================================
// Discount Definitions
// ============================================================================

export interface DiscountRule {
  type: 'volume' | 'contract_term' | 'early_adopter' | 'partner_referral' | 'custom';
  name: string;
  ratePercent: number;
  appliesTo: 'per_member' | 'base_fee' | 'total';
  /** Minimum member count to qualify (volume). */
  memberThreshold?: number;
  /** Minimum contract months to qualify (contract_term). */
  contractTermMinMonths?: number;
}

/**
 * Canonical discount rules from Excel model.
 */
export const GTM_DISCOUNTS: readonly DiscountRule[] = [
  {
    type: 'contract_term',
    name: '3-Year Contract Lock-in',
    ratePercent: 10.0,
    appliesTo: 'total',
    contractTermMinMonths: 36,
  },
  {
    type: 'volume',
    name: 'Volume (50k+ Members)',
    ratePercent: 15.0,
    appliesTo: 'per_member',
    memberThreshold: 50_000,
  },
] as const;

// ============================================================================
// Cost Assumptions (from Excel "Assumptions" sheet)
// ============================================================================

export interface CostAssumptions {
  cloudHostingBase: number;           // $/yr
  cloudHostingPer1kMembers: number;   // $/yr/1k members
  engineeringTeam: number;            // $/yr
  productDesign: number;              // $/yr
  customerSuccess: number;            // $/yr
  salesMarketing: number;             // $/yr
  legalCompliance: number;            // $/yr
  adminOverhead: number;              // $/yr
  implementationCostPerRegion: number; // $/region (internal cost)
  variableCostPerMemberMonth: number;  // $/member/month
}

export const DEFAULT_COST_ASSUMPTIONS: CostAssumptions = {
  cloudHostingBase: 36_000,
  cloudHostingPer1kMembers: 120,
  engineeringTeam: 480_000,
  productDesign: 150_000,
  customerSuccess: 120_000,
  salesMarketing: 96_000,
  legalCompliance: 36_000,
  adminOverhead: 60_000,
  implementationCostPerRegion: 3_500,
  variableCostPerMemberMonth: 0.15,
};

export function totalFixedCosts(costs: CostAssumptions = DEFAULT_COST_ASSUMPTIONS): number {
  return (
    costs.cloudHostingBase +
    costs.engineeringTeam +
    costs.productDesign +
    costs.customerSuccess +
    costs.salesMarketing +
    costs.legalCompliance +
    costs.adminOverhead
  );
}

// ============================================================================
// Regional Deployment Model
// ============================================================================

export interface RegionDeploymentCost {
  regionCode: string;
  regionName: string;
  estimatedLocals: number;
  implementationFee: number;   // one-time
  annualSupport: number;       // recurring
  annualHostingAddOn: number;  // recurring
}

export const CANADA_REGIONS: readonly RegionDeploymentCost[] = [
  { regionCode: 'BC',  regionName: 'British Columbia',        estimatedLocals: 45,  implementationFee: 5_000, annualSupport: 4_250, annualHostingAddOn: 1_125 },
  { regionCode: 'AB',  regionName: 'Alberta',                 estimatedLocals: 30,  implementationFee: 5_000, annualSupport: 3_500, annualHostingAddOn: 750 },
  { regionCode: 'SK',  regionName: 'Saskatchewan',            estimatedLocals: 15,  implementationFee: 5_000, annualSupport: 2_750, annualHostingAddOn: 375 },
  { regionCode: 'MB',  regionName: 'Manitoba',                estimatedLocals: 15,  implementationFee: 5_000, annualSupport: 2_750, annualHostingAddOn: 375 },
  { regionCode: 'ON',  regionName: 'Ontario',                 estimatedLocals: 120, implementationFee: 5_000, annualSupport: 8_000, annualHostingAddOn: 3_000 },
  { regionCode: 'QC',  regionName: 'Quebec',                  estimatedLocals: 80,  implementationFee: 5_000, annualSupport: 6_000, annualHostingAddOn: 2_000 },
  { regionCode: 'NB',  regionName: 'New Brunswick',           estimatedLocals: 10,  implementationFee: 5_000, annualSupport: 2_500, annualHostingAddOn: 250 },
  { regionCode: 'NS',  regionName: 'Nova Scotia',             estimatedLocals: 12,  implementationFee: 5_000, annualSupport: 2_600, annualHostingAddOn: 300 },
  { regionCode: 'PE',  regionName: 'Prince Edward Island',    estimatedLocals: 5,   implementationFee: 5_000, annualSupport: 2_250, annualHostingAddOn: 125 },
  { regionCode: 'NL',  regionName: 'Newfoundland & Labrador', estimatedLocals: 8,   implementationFee: 5_000, annualSupport: 2_400, annualHostingAddOn: 200 },
  { regionCode: 'NT',  regionName: 'Northern Territories',    estimatedLocals: 5,   implementationFee: 5_000, annualSupport: 2_250, annualHostingAddOn: 125 },
] as const;

// ============================================================================
// Quote Input / Output
// ============================================================================

export interface PricingQuoteInput {
  /** Number of members in the union/org. */
  memberCount: number;
  /** Explicit tier override; auto-resolved from memberCount if omitted. */
  tier?: GtmTier;
  /** Number of regions to deploy to (for implementation fees). */
  regionCount?: number;
  /** Specific region codes to deploy (overrides regionCount). */
  regions?: string[];
  /** Contract term in months (for contract-term discounts). */
  contractTermMonths?: number;
  /** Contract year (1-indexed) for escalator calculation. */
  contractYear?: number;
  /** Additional ad-hoc discounts to stack. */
  customDiscounts?: DiscountRule[];
}

export interface DiscountLineItem {
  name: string;
  type: string;
  ratePercent: number;
  appliesTo: string;
  savingsAmount: number;
}

export interface RegionalCostSummary {
  totalImplementation: number;
  totalAnnualRecurring: number;
  totalYear1: number;
  totalYear2Plus: number;
  regions: Array<{
    regionCode: string;
    regionName: string;
    year1: number;
    year2Plus: number;
  }>;
}

export interface PricingQuoteResult {
  tier: GtmTierDefinition;
  memberCount: number;
  contractTermMonths: number;
  contractYear: number;

  // Revenue components
  baseFeeAnnual: number;
  perMemberAnnual: number;
  perMemberRevenue: number;  // perMemberAnnual × memberCount
  grossRevenue: number;       // baseFee + perMemberRevenue (before discounts)

  // Escalator
  escalatorPercent: number;
  escalatorAmount: number;

  // Discounts
  discounts: DiscountLineItem[];
  totalDiscount: number;

  // Net revenue
  netRevenue: number;

  // Implementation & regional
  implementationFees: number;
  regionalCosts: RegionalCostSummary | null;

  // Total Year 1 (net revenue + implementation + regional year 1)
  totalYear1Revenue: number;

  // Cost model
  variableCostAnnual: number;
  contributionMargin: number;
  contributionMarginPercent: number;

  // Breakeven
  breakeven: {
    membersForOneCient: number;
    membersForThreeClients: number;
    membersForFiveClients: number;
    fixedCostsUsed: number;
  };

  generatedAt: string;
  currency: 'CAD';
}

// ============================================================================
// Core Calculator Functions
// ============================================================================

/**
 * Resolve the GTM tier for a given member count.
 * Uses the canonical band definitions. Falls back to enterprise for counts
 * exceeding all bands.
 */
export function resolveTier(memberCount: number): GtmTierDefinition {
  for (const tier of GTM_TIERS) {
    const inMin = memberCount >= tier.memberBandMin;
    const inMax = tier.memberBandMax === null || memberCount <= tier.memberBandMax;
    if (inMin && inMax) return tier;
  }
  // Below minimum band — use starter
  if (memberCount < GTM_TIERS[0].memberBandMin) return GTM_TIERS[0];
  // Above all bands — use enterprise
  return GTM_TIERS[GTM_TIERS.length - 1];
}

/**
 * Evaluate which discount rules apply to a given quote context.
 */
export function evaluateDiscounts(
  memberCount: number,
  contractTermMonths: number,
  customDiscounts: DiscountRule[] = [],
): DiscountRule[] {
  const applicable: DiscountRule[] = [];

  for (const rule of [...GTM_DISCOUNTS, ...customDiscounts]) {
    if (rule.type === 'volume' && rule.memberThreshold && memberCount < rule.memberThreshold) {
      continue;
    }
    if (rule.type === 'contract_term' && rule.contractTermMinMonths && contractTermMonths < rule.contractTermMinMonths) {
      continue;
    }
    applicable.push(rule);
  }

  return applicable;
}

/**
 * Calculate regional deployment costs for specified regions.
 */
export function calculateRegionalCosts(
  regionCodes?: string[],
  regionCount?: number,
): RegionalCostSummary | null {
  if (!regionCodes?.length && !regionCount) return null;

  let selectedRegions: RegionDeploymentCost[];

  if (regionCodes?.length) {
    const codeSet = new Set(regionCodes.map(c => c.toUpperCase()));
    selectedRegions = CANADA_REGIONS.filter(r => codeSet.has(r.regionCode));
  } else {
    // Take first N regions (largest first: ON, QC, BC, ...)
    selectedRegions = CANADA_REGIONS.slice(0, regionCount);
  }

  if (!selectedRegions.length) return null;

  const regions = selectedRegions.map(r => ({
    regionCode: r.regionCode,
    regionName: r.regionName,
    year1: r.implementationFee + r.annualSupport + r.annualHostingAddOn,
    year2Plus: r.annualSupport + r.annualHostingAddOn,
  }));

  const totalImplementation = selectedRegions.reduce((s, r) => s + r.implementationFee, 0);
  const totalAnnualRecurring = selectedRegions.reduce((s, r) => s + r.annualSupport + r.annualHostingAddOn, 0);

  return {
    totalImplementation,
    totalAnnualRecurring,
    totalYear1: totalImplementation + totalAnnualRecurring,
    totalYear2Plus: totalAnnualRecurring,
    regions,
  };
}

/**
 * Compute a full pricing quote.
 *
 * This is a pure function — no database access. All inputs are explicit.
 * Suitable for API endpoints, simulations, and unit testing.
 */
export function computeQuote(
  input: PricingQuoteInput,
  costs: CostAssumptions = DEFAULT_COST_ASSUMPTIONS,
): PricingQuoteResult {
  const { memberCount, contractTermMonths = 12, contractYear = 1 } = input;

  if (memberCount < 1) throw new Error('memberCount must be ≥ 1');
  if (contractTermMonths < 1) throw new Error('contractTermMonths must be ≥ 1');
  if (contractYear < 1) throw new Error('contractYear must be ≥ 1');

  // 1. Resolve tier
  const tier = input.tier
    ? GTM_TIERS.find(t => t.tier === input.tier) ?? resolveTier(memberCount)
    : resolveTier(memberCount);

  // 2. Base revenue components
  const baseFeeAnnual = tier.baseFeeAnnual;
  const perMemberAnnual = tier.perMemberAnnual;
  const perMemberRevenue = perMemberAnnual * memberCount;
  const grossRevenue = baseFeeAnnual + perMemberRevenue;

  // 3. Escalator (3% per year, applied from year 2+)
  const escalatorPercent = contractYear > 1 ? 3.0 : 0;
  const escalatorMultiplier = contractYear > 1
    ? Math.pow(1.03, contractYear - 1)
    : 1;
  const escalatedGross = grossRevenue * escalatorMultiplier;
  const escalatorAmount = escalatedGross - grossRevenue;

  // 4. Evaluate discounts
  const applicableDiscounts = evaluateDiscounts(
    memberCount,
    contractTermMonths,
    input.customDiscounts,
  );

  const discountLines: DiscountLineItem[] = [];
  let perMemberDiscount = 0;
  let baseFeeDiscount = 0;
  let totalDiscount = 0;

  for (const rule of applicableDiscounts) {
    let savings = 0;
    switch (rule.appliesTo) {
      case 'per_member':
        savings = perMemberRevenue * escalatorMultiplier * (rule.ratePercent / 100);
        perMemberDiscount += savings;
        break;
      case 'base_fee':
        savings = baseFeeAnnual * escalatorMultiplier * (rule.ratePercent / 100);
        baseFeeDiscount += savings;
        break;
      case 'total':
        savings = escalatedGross * (rule.ratePercent / 100);
        totalDiscount += savings;
        break;
    }
    discountLines.push({
      name: rule.name,
      type: rule.type,
      ratePercent: rule.ratePercent,
      appliesTo: rule.appliesTo,
      savingsAmount: round2(savings),
    });
  }

  const allDiscounts = round2(perMemberDiscount + baseFeeDiscount + totalDiscount);
  const netRevenue = round2(escalatedGross - allDiscounts);

  // 5. Implementation & regional
  const regionalCosts = calculateRegionalCosts(input.regions, input.regionCount);
  const implementationFees = regionalCosts?.totalImplementation ?? 0;

  // 6. Total Year 1
  const totalYear1Revenue = round2(
    netRevenue + implementationFees + (regionalCosts?.totalAnnualRecurring ?? 0),
  );

  // 7. Cost model
  const variableCostAnnual = round2(costs.variableCostPerMemberMonth * memberCount * 12);
  const contributionMargin = round2(netRevenue - variableCostAnnual);
  const contributionMarginPercent = netRevenue > 0
    ? round2((contributionMargin / netRevenue) * 100)
    : 0;

  // 8. Breakeven analysis
  const fixedCosts = totalFixedCosts(costs);
  const contributionPerMember = perMemberAnnual - (costs.variableCostPerMemberMonth * 12);

  const breakevenForClients = (clientCount: number) => {
    if (contributionPerMember <= 0) return Infinity;
    const netFixed = fixedCosts - (baseFeeAnnual * clientCount);
    return Math.ceil(Math.max(0, netFixed) / contributionPerMember);
  };

  return {
    tier,
    memberCount,
    contractTermMonths,
    contractYear,

    baseFeeAnnual,
    perMemberAnnual,
    perMemberRevenue: round2(perMemberRevenue),
    grossRevenue: round2(grossRevenue),

    escalatorPercent,
    escalatorAmount: round2(escalatorAmount),

    discounts: discountLines,
    totalDiscount: allDiscounts,

    netRevenue,

    implementationFees,
    regionalCosts,

    totalYear1Revenue,

    variableCostAnnual,
    contributionMargin,
    contributionMarginPercent,

    breakeven: {
      membersForOneCient: breakevenForClients(1),
      membersForThreeClients: breakevenForClients(3),
      membersForFiveClients: breakevenForClients(5),
      fixedCostsUsed: fixedCosts,
    },

    generatedAt: new Date().toISOString(),
    currency: 'CAD',
  };
}

// ============================================================================
// Multi-Year Revenue Projection
// ============================================================================

export interface YearProjection {
  year: number;
  grossRevenue: number;
  discounts: number;
  netRevenue: number;
  implementationFees: number;
  regionalRecurring: number;
  totalRevenue: number;
  variableCosts: number;
  contributionMargin: number;
}

/**
 * Generate a multi-year revenue projection for a single client.
 */
export function projectRevenue(
  input: PricingQuoteInput,
  years: number = 3,
  costs: CostAssumptions = DEFAULT_COST_ASSUMPTIONS,
): YearProjection[] {
  const projections: YearProjection[] = [];

  for (let year = 1; year <= years; year++) {
    const quote = computeQuote(
      { ...input, contractYear: year },
      costs,
    );

    projections.push({
      year,
      grossRevenue: quote.grossRevenue + quote.escalatorAmount,
      discounts: quote.totalDiscount,
      netRevenue: quote.netRevenue,
      implementationFees: year === 1 ? quote.implementationFees : 0,
      regionalRecurring: quote.regionalCosts?.totalAnnualRecurring ?? 0,
      totalRevenue: year === 1
        ? quote.totalYear1Revenue
        : quote.netRevenue + (quote.regionalCosts?.totalAnnualRecurring ?? 0),
      variableCosts: quote.variableCostAnnual,
      contributionMargin: quote.contributionMargin,
    });
  }

  return projections;
}

// ============================================================================
// Tier Comparison Matrix
// ============================================================================

export interface TierComparison {
  tier: GtmTier;
  label: string;
  memberCount: number;
  annualRevenue: number;
  implementationFee: number;
}

/**
 * Generate a comparison of all tiers for a given member count + region count.
 */
export function compareTiers(
  memberCount: number,
  regionCount: number = 0,
): TierComparison[] {
  return GTM_TIERS.map(tierDef => {
    const revenue = tierDef.baseFeeAnnual + (tierDef.perMemberAnnual * memberCount);
    const implFee = regionCount * 5_000; // $5K per region
    return {
      tier: tierDef.tier,
      label: tierDef.label,
      memberCount,
      annualRevenue: round2(revenue),
      implementationFee: implFee,
    };
  });
}

// ============================================================================
// Helpers
// ============================================================================

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

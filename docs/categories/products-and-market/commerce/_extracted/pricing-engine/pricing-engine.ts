/**
 * Nzila Commerce — Pricing Engine (Extracted from Legacy)
 *
 * Pure-function pricing calculations with Quebec tax compliance.
 * Zero DB access. Deterministic inputs → deterministic outputs.
 *
 * Source: shop_quoter_tool_v1-main/src/lib/margin-solver.ts
 * Extraction date: 2026-02-24
 */

// ─── Types ───────────────────────────────────────────────────────────

export type Tier = 'budget' | 'standard' | 'premium';

export interface PricingItem {
  productId: string;
  quantity: number;
  unitCost: number;
}

export interface PricingTemplate {
  /** Margin targets per tier (percentage, e.g. 38.0 = 38%) */
  budgetMarginTarget: number;
  standardMarginTarget: number;
  premiumMarginTarget: number;

  /** Floor margins — minimums requiring approval if breached */
  budgetMarginFloor: number;
  standardMarginFloor: number;
  premiumMarginFloor: number;

  /** Fixed cost components per box (CAD) */
  packagingCostPerBox: number;
  laborCostPerBox: number;
  shippingCostPerBox: number;

  /** Quebec tax rates */
  gstRate: number; // 0.05
  qstRate: number; // 0.09975
}

export interface MarginCalculation {
  tier: Tier;
  componentsCost: number;
  packagingCost: number;
  laborCost: number;
  shippingCost: number;
  totalCogs: number;
  targetMargin: number;
  priceBeforeTax: number;
  gstAmount: number;
  qstAmount: number;
  totalTax: number;
  finalPrice: number;
  actualMargin: number;
  marginAmount: number;
  isAboveFloor: boolean;
}

export interface BreakEvenResult {
  minimumPrice: number;
  zeroMarginPrice: number;
  recommendedPrice: number;
  analysis: string;
}

export interface TargetOptimizationResult {
  pricePerBox: number;
  margin: number;
  adjustmentNeeded: boolean;
  suggestion: string;
}

export interface VolumeTier {
  minQuantity: number;
  discountPercent: number;
}

export interface VolumeAnalysisRow {
  quantity: number;
  discountPercent: number;
  pricePerBox: number;
  totalPrice: number;
  margin: number;
}

export interface TaxBreakdown {
  gst: number;
  qst: number;
  total: number;
  finalPrice: number;
}

export type Result<T> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string };

// ─── Pricing Engine ──────────────────────────────────────────────────

/**
 * Calculate exact tier pricing with Quebec tax compliance.
 *
 * Formula:
 *   COGS = Σ(item.unitCost × item.quantity) + (packaging + labor + shipping) × boxCount
 *   PriceBeforeTax = COGS ÷ (1 − targetMargin%)
 *   GST = PriceBeforeTax × gstRate
 *   QST = (PriceBeforeTax + GST) × qstRate        ← Quebec rule
 *   FinalPrice = PriceBeforeTax + GST + QST − volumeDiscount
 */
export function calculateTierPricing(
  items: PricingItem[],
  boxCount: number,
  tier: Tier,
  template: PricingTemplate,
): Result<MarginCalculation> {
  // ── Input validation ──
  if (!items || items.length === 0) {
    return { success: false, error: 'Invalid input: items list cannot be empty' };
  }
  if (boxCount <= 0) {
    return { success: false, error: 'Invalid input: boxCount must be positive' };
  }
  for (const item of items) {
    if (item.unitCost < 0) {
      return { success: false, error: 'Invalid input: negative costs not allowed' };
    }
    if (item.quantity <= 0) {
      return { success: false, error: 'Invalid input: item quantity must be positive' };
    }
  }
  if (
    template.packagingCostPerBox < 0 ||
    template.laborCostPerBox < 0 ||
    template.shippingCostPerBox < 0 ||
    template.gstRate < 0 ||
    template.qstRate < 0
  ) {
    return { success: false, error: 'Invalid pricing template: negative costs or tax rates not allowed' };
  }

  // ── 1. Components cost ──
  const componentsCost = items.reduce((sum, i) => sum + i.unitCost * i.quantity, 0);

  // ── 2. Fixed costs per box × box count ──
  const packagingCost = template.packagingCostPerBox * boxCount;
  const laborCost = template.laborCostPerBox * boxCount;
  const shippingCost = template.shippingCostPerBox * boxCount;
  const totalCogs = componentsCost + packagingCost + laborCost + shippingCost;

  // ── 3. Target margin ──
  const targetMargin = getTargetMargin(tier, template);
  const floorMargin = getFloorMargin(tier, template);

  // ── 4. Price before tax ──
  const priceBeforeTax = totalCogs / (1 - targetMargin / 100);

  // ── 5. Quebec taxes ──
  const gstAmount = priceBeforeTax * template.gstRate;
  const qstAmount = (priceBeforeTax + gstAmount) * template.qstRate; // QST on (base + GST)
  const totalTax = gstAmount + qstAmount;
  let finalPrice = priceBeforeTax + totalTax;

  // ── 6. Volume discounts ──
  const volumeDiscount = getVolumeDiscount(boxCount);
  if (volumeDiscount > 0) {
    finalPrice = finalPrice * (1 - volumeDiscount / 100);
  }

  // ── 7. Actual margin verification ──
  const actualMargin = ((priceBeforeTax - totalCogs) / priceBeforeTax) * 100;
  const marginAmount = priceBeforeTax - totalCogs;
  const isAboveFloor = actualMargin >= floorMargin;

  return {
    success: true,
    data: {
      tier,
      componentsCost,
      packagingCost,
      laborCost,
      shippingCost,
      totalCogs,
      targetMargin,
      priceBeforeTax,
      gstAmount,
      qstAmount,
      totalTax,
      finalPrice,
      actualMargin,
      marginAmount,
      isAboveFloor,
    },
    message: isAboveFloor ? 'Margin calculation successful' : 'Warning: Below floor margin',
  };
}

/**
 * Calculate pricing for all three tiers in one call.
 */
export function calculateAllTiers(
  items: PricingItem[],
  boxCount: number,
  template: PricingTemplate,
): Result<{ budget: MarginCalculation; standard: MarginCalculation; premium: MarginCalculation }> {
  const budget = calculateTierPricing(items, boxCount, 'budget', template);
  const standard = calculateTierPricing(items, boxCount, 'standard', template);
  const premium = calculateTierPricing(items, boxCount, 'premium', template);

  if (!budget.success) return { success: false, error: `Budget tier failed: ${budget.error}` };
  if (!standard.success) return { success: false, error: `Standard tier failed: ${standard.error}` };
  if (!premium.success) return { success: false, error: `Premium tier failed: ${premium.error}` };

  return {
    success: true,
    data: { budget: budget.data, standard: standard.data, premium: premium.data },
  };
}

/**
 * Validate a margin against the configured floor for a tier.
 */
export function validateMarginFloor(
  actualMargin: number,
  tier: Tier,
  template: PricingTemplate,
): { isValid: boolean; floorMargin: number; message: string } {
  const floorMargin = getFloorMargin(tier, template);
  const isValid = actualMargin >= floorMargin;
  return {
    isValid,
    floorMargin,
    message: isValid
      ? `Margin ${actualMargin.toFixed(2)}% exceeds floor of ${floorMargin}%`
      : `Margin ${actualMargin.toFixed(2)}% below floor of ${floorMargin}% — requires approval`,
  };
}

/**
 * Break-even analysis: what price yields zero margin, and what is recommended?
 */
export function calculateBreakEven(
  items: PricingItem[],
  template: PricingTemplate,
): Result<BreakEvenResult> {
  const componentsCost = items.reduce((sum, i) => sum + i.unitCost * i.quantity, 0);
  const fixedCosts =
    template.packagingCostPerBox + template.laborCostPerBox + template.shippingCostPerBox;
  const totalCogs = componentsCost + fixedCosts;

  const taxMultiplier = 1 + template.gstRate + template.qstRate + template.gstRate * template.qstRate;
  const minimumPrice = totalCogs * taxMultiplier;

  const standardMargin = template.standardMarginTarget;
  const recommendedPrice = (totalCogs / (1 - standardMargin / 100)) * taxMultiplier;

  return {
    success: true,
    data: {
      minimumPrice,
      zeroMarginPrice: totalCogs,
      recommendedPrice,
      analysis: [
        `Components: $${componentsCost.toFixed(2)}`,
        `Fixed Costs: $${fixedCosts.toFixed(2)}`,
        `Total COGS: $${totalCogs.toFixed(2)}`,
        `Break-even (with tax): $${minimumPrice.toFixed(2)}`,
        `Recommended (${standardMargin}% margin): $${recommendedPrice.toFixed(2)}`,
      ].join('\n'),
    },
  };
}

/**
 * Given a target total, calculate required per-box price and resulting margin.
 */
export function optimizeForTargetTotal(
  targetTotal: number,
  boxCount: number,
  items: PricingItem[],
  template: PricingTemplate,
): Result<TargetOptimizationResult> {
  const componentsCost = items.reduce((sum, i) => sum + i.unitCost * i.quantity, 0);
  const fixedCosts =
    template.packagingCostPerBox + template.laborCostPerBox + template.shippingCostPerBox;
  const totalCogs = componentsCost + fixedCosts;

  const pricePerBox = targetTotal / boxCount;

  const taxMultiplier = 1 + template.gstRate + template.qstRate + template.gstRate * template.qstRate;
  const basePricePerBox = pricePerBox / taxMultiplier;

  const margin = ((basePricePerBox - totalCogs) / basePricePerBox) * 100;

  const adjustmentNeeded = margin < template.budgetMarginFloor;

  let suggestion: string;
  if (adjustmentNeeded) {
    const recommendedPrice = (totalCogs / (1 - template.standardMarginTarget / 100)) * taxMultiplier;
    suggestion = `Target too low. Recommended: $${recommendedPrice.toFixed(2)} per box for ${template.standardMarginTarget}% margin`;
  } else if (margin > 50) {
    suggestion = 'Price may be too high for market acceptance';
  } else {
    suggestion = 'Target price achievable with good margin';
  }

  return {
    success: true,
    data: { pricePerBox: basePricePerBox, margin, adjustmentNeeded, suggestion },
  };
}

/**
 * Quebec tax calculation (standalone).
 * QST is calculated on (basePrice + GST) per Quebec Revenue Agency rules.
 */
export function calculateQuebecTaxes(
  basePrice: number,
  gstRate: number = 0.05,
  qstRate: number = 0.09975,
): TaxBreakdown {
  const gst = basePrice * gstRate;
  const qst = (basePrice + gst) * qstRate;
  return { gst, qst, total: gst + qst, finalPrice: basePrice + gst + qst };
}

/**
 * Reverse-calculate base price from a tax-inclusive final price.
 */
export function reverseCalculateBasePrice(
  finalPrice: number,
  gstRate: number = 0.05,
  qstRate: number = 0.09975,
): number {
  const taxMultiplier = 1 + gstRate + qstRate + gstRate * qstRate;
  return finalPrice / taxMultiplier;
}

/**
 * Compute volume discount analysis for multiple quantity tiers.
 */
export function calculateVolumeAnalysis(
  baseMargin: MarginCalculation,
  volumeTiers: VolumeTier[],
): VolumeAnalysisRow[] {
  return volumeTiers.map((tier) => {
    const discountedPrice = baseMargin.finalPrice * (1 - tier.discountPercent / 100);
    const basePriceAfterDiscount =
      discountedPrice /
      (1 +
        baseMargin.gstAmount / baseMargin.priceBeforeTax +
        baseMargin.qstAmount / (baseMargin.priceBeforeTax + baseMargin.gstAmount));
    const newMargin =
      ((basePriceAfterDiscount - baseMargin.totalCogs) / basePriceAfterDiscount) * 100;

    return {
      quantity: tier.minQuantity,
      discountPercent: tier.discountPercent,
      pricePerBox: discountedPrice,
      totalPrice: discountedPrice * tier.minQuantity,
      margin: newMargin,
    };
  });
}

/**
 * Format currency for display (CAD, fr-CA locale).
 */
export function formatCurrency(amount: number, currency: string = 'CAD'): string {
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format percentage for display.
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

// ─── Internal helpers ────────────────────────────────────────────────

function getTargetMargin(tier: Tier, t: PricingTemplate): number {
  switch (tier) {
    case 'budget':
      return t.budgetMarginTarget;
    case 'standard':
      return t.standardMarginTarget;
    case 'premium':
      return t.premiumMarginTarget;
  }
}

function getFloorMargin(tier: Tier, t: PricingTemplate): number {
  switch (tier) {
    case 'budget':
      return t.budgetMarginFloor;
    case 'standard':
      return t.standardMarginFloor;
    case 'premium':
      return t.premiumMarginFloor;
  }
}

function getVolumeDiscount(boxCount: number): number {
  if (boxCount >= 500) return 15;
  if (boxCount >= 250) return 10;
  return 0;
}

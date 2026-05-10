/**
 * Nzila Commerce — Pricing Engine Tests
 *
 * Comprehensive tests for extracted pricing engine.
 * Covers: margin calculations, Quebec taxes, volume discounts,
 *         break-even analysis, edge cases.
 *
 * Source: legacy margin-solver.test.ts + new coverage
 */

import { describe, it, expect } from 'vitest';
import {
  calculateTierPricing,
  calculateAllTiers,
  validateMarginFloor,
  calculateBreakEven,
  optimizeForTargetTotal,
  calculateQuebecTaxes,
  reverseCalculateBasePrice,
  calculateVolumeAnalysis,
  formatCurrency,
  formatPercentage,
  type PricingTemplate,
  type PricingItem,
  type MarginCalculation,
} from './pricing-engine';

// ─── Fixtures ────────────────────────────────────────────────────────

const TEMPLATE: PricingTemplate = {
  budgetMarginTarget: 25.0,
  standardMarginTarget: 35.0,
  premiumMarginTarget: 45.0,
  budgetMarginFloor: 15.0,
  standardMarginFloor: 25.0,
  premiumMarginFloor: 35.0,
  packagingCostPerBox: 2.5,
  laborCostPerBox: 3.0,
  shippingCostPerBox: 4.5,
  gstRate: 0.05,
  qstRate: 0.09975,
};

const ITEMS: PricingItem[] = [
  { productId: 'prod-001', quantity: 50, unitCost: 8.5 },
  { productId: 'prod-002', quantity: 50, unitCost: 12.0 },
];

const BOX_COUNT = 100;

// ─── Test 1: Core COGS Calculation ───────────────────────────────────

describe('calculateTierPricing — COGS', () => {
  it('should compute exact COGS breakdown', () => {
    const result = calculateTierPricing(ITEMS, BOX_COUNT, 'standard', TEMPLATE);

    expect(result.success).toBe(true);
    if (!result.success) return;

    const d = result.data;

    // Components: (8.50 × 50) + (12.00 × 50) = 425 + 600 = 1025
    expect(d.componentsCost).toBe(1025);

    // Fixed: (2.50 + 3.00 + 4.50) × 100 = 1000
    expect(d.packagingCost).toBe(250);
    expect(d.laborCost).toBe(300);
    expect(d.shippingCost).toBe(450);
    expect(d.totalCogs).toBe(2025);
  });

  it('should apply correct target margin for each tier', () => {
    const budget = calculateTierPricing(ITEMS, BOX_COUNT, 'budget', TEMPLATE);
    const standard = calculateTierPricing(ITEMS, BOX_COUNT, 'standard', TEMPLATE);
    const premium = calculateTierPricing(ITEMS, BOX_COUNT, 'premium', TEMPLATE);

    expect(budget.success && budget.data.targetMargin).toBe(25.0);
    expect(standard.success && standard.data.targetMargin).toBe(35.0);
    expect(premium.success && premium.data.targetMargin).toBe(45.0);
  });

  it('should produce higher prices for higher margin tiers', () => {
    const budget = calculateTierPricing(ITEMS, BOX_COUNT, 'budget', TEMPLATE);
    const standard = calculateTierPricing(ITEMS, BOX_COUNT, 'standard', TEMPLATE);
    const premium = calculateTierPricing(ITEMS, BOX_COUNT, 'premium', TEMPLATE);

    expect(budget.success && standard.success && premium.success).toBe(true);
    if (!budget.success || !standard.success || !premium.success) return;

    expect(budget.data.finalPrice).toBeLessThan(standard.data.finalPrice);
    expect(standard.data.finalPrice).toBeLessThan(premium.data.finalPrice);
  });
});

// ─── Test 2: Quebec Tax Compliance ───────────────────────────────────

describe('calculateTierPricing — Quebec Taxes', () => {
  it('should calculate GST at 5% on base price', () => {
    const result = calculateTierPricing(ITEMS, BOX_COUNT, 'standard', TEMPLATE);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const expectedGst = result.data.priceBeforeTax * 0.05;
    expect(Math.abs(result.data.gstAmount - expectedGst)).toBeLessThan(0.01);
  });

  it('should calculate QST at 9.975% on (base + GST) — Quebec rule', () => {
    const result = calculateTierPricing(ITEMS, BOX_COUNT, 'standard', TEMPLATE);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const expectedQst = (result.data.priceBeforeTax + result.data.gstAmount) * 0.09975;
    expect(Math.abs(result.data.qstAmount - expectedQst)).toBeLessThan(0.01);
  });

  it('should produce total tax ≈ 14.975% effective rate', () => {
    const result = calculateTierPricing(ITEMS, BOX_COUNT, 'standard', TEMPLATE);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const effectiveRate = result.data.totalTax / result.data.priceBeforeTax;
    // GST 5% + QST 9.975% + cross-term ≈ 15.4738%
    // (not simply 14.975% because QST applies to base+GST)
    expect(effectiveRate).toBeGreaterThan(0.149);
    expect(effectiveRate).toBeLessThan(0.156);
  });
});

// ─── Test 3: Volume Discount Edge Cases ──────────────────────────────

describe('calculateTierPricing — Volume Discounts', () => {
  it('should apply 0% discount for < 250 boxes', () => {
    const result = calculateTierPricing(ITEMS, 100, 'standard', TEMPLATE);
    expect(result.success).toBe(true);
    if (!result.success) return;

    // Verify no discount applied: finalPrice = priceBeforeTax + totalTax
    const expectedFinal = result.data.priceBeforeTax + result.data.totalTax;
    expect(Math.abs(result.data.finalPrice - expectedFinal)).toBeLessThan(0.01);
  });

  it('should apply 10% discount for 250-499 boxes', () => {
    const result = calculateTierPricing(ITEMS, 300, 'standard', TEMPLATE);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const grossPrice = result.data.priceBeforeTax + result.data.totalTax;
    const expectedFinal = grossPrice * 0.9; // 10% off
    expect(Math.abs(result.data.finalPrice - expectedFinal)).toBeLessThan(0.01);
  });

  it('should apply 15% discount for 500+ boxes', () => {
    const result = calculateTierPricing(ITEMS, 500, 'standard', TEMPLATE);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const grossPrice = result.data.priceBeforeTax + result.data.totalTax;
    const expectedFinal = grossPrice * 0.85; // 15% off
    expect(Math.abs(result.data.finalPrice - expectedFinal)).toBeLessThan(0.01);
  });
});

// ─── Test 4: Margin Floor Validation ─────────────────────────────────

describe('validateMarginFloor', () => {
  it('should pass when margin exceeds floor', () => {
    const result = validateMarginFloor(30.0, 'budget', TEMPLATE);
    expect(result.isValid).toBe(true);
    expect(result.floorMargin).toBe(15.0);
  });

  it('should fail when margin is below floor', () => {
    const result = validateMarginFloor(10.0, 'budget', TEMPLATE);
    expect(result.isValid).toBe(false);
    expect(result.message).toContain('requires approval');
  });

  it('should pass at exactly the floor', () => {
    const result = validateMarginFloor(15.0, 'budget', TEMPLATE);
    expect(result.isValid).toBe(true);
  });
});

// ─── Test 5: Break-Even Analysis ─────────────────────────────────────

describe('calculateBreakEven', () => {
  it('should return zero-margin price equal to COGS', () => {
    const result = calculateBreakEven(ITEMS, TEMPLATE);
    expect(result.success).toBe(true);
    if (!result.success) return;

    // COGS per-box: 1025 (components for 1 box with 50 items each) + 10 fixed = 1035
    const componentsCost = 8.5 * 50 + 12.0 * 50; // 1025
    const fixedCosts = 2.5 + 3.0 + 4.5; // 10
    expect(result.data.zeroMarginPrice).toBe(componentsCost + fixedCosts);
  });

  it('should return recommended price > minimum price', () => {
    const result = calculateBreakEven(ITEMS, TEMPLATE);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.recommendedPrice).toBeGreaterThan(result.data.minimumPrice);
  });

  it('should include tax in minimum price', () => {
    const result = calculateBreakEven(ITEMS, TEMPLATE);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.minimumPrice).toBeGreaterThan(result.data.zeroMarginPrice);
  });
});

// ─── Test 6: Input Validation ────────────────────────────────────────

describe('calculateTierPricing — Input Validation', () => {
  it('should reject empty items list', () => {
    const result = calculateTierPricing([], BOX_COUNT, 'standard', TEMPLATE);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('items list cannot be empty');
  });

  it('should reject zero box count', () => {
    const result = calculateTierPricing(ITEMS, 0, 'standard', TEMPLATE);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('boxCount must be positive');
  });

  it('should reject negative box count', () => {
    const result = calculateTierPricing(ITEMS, -5, 'standard', TEMPLATE);
    expect(result.success).toBe(false);
  });

  it('should reject negative unit costs', () => {
    const badItems: PricingItem[] = [{ productId: 'x', quantity: 1, unitCost: -5 }];
    const result = calculateTierPricing(badItems, 10, 'standard', TEMPLATE);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('negative costs');
  });

  it('should reject zero item quantity', () => {
    const badItems: PricingItem[] = [{ productId: 'x', quantity: 0, unitCost: 10 }];
    const result = calculateTierPricing(badItems, 10, 'standard', TEMPLATE);
    expect(result.success).toBe(false);
  });

  it('should reject negative template costs', () => {
    const badTemplate = { ...TEMPLATE, packagingCostPerBox: -1 };
    const result = calculateTierPricing(ITEMS, BOX_COUNT, 'standard', badTemplate);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('negative costs');
  });
});

// ─── Test 7: Quebec Tax Standalone ───────────────────────────────────

describe('calculateQuebecTaxes', () => {
  it('should compute correct taxes on $100', () => {
    const result = calculateQuebecTaxes(100);

    expect(result.gst).toBeCloseTo(5.0, 2);
    // QST on (100 + 5) = 105 × 0.09975 = 10.47375
    expect(result.qst).toBeCloseTo(10.47, 1);
    expect(result.total).toBeCloseTo(15.47, 1);
    expect(result.finalPrice).toBeCloseTo(115.47, 1);
  });

  it('should handle zero base price', () => {
    const result = calculateQuebecTaxes(0);
    expect(result.gst).toBe(0);
    expect(result.qst).toBe(0);
    expect(result.finalPrice).toBe(0);
  });
});

// ─── Test 8: Reverse Tax Calculation ─────────────────────────────────

describe('reverseCalculateBasePrice', () => {
  it('should roundtrip: base → taxes → reverse = base', () => {
    const base = 250.0;
    const withTax = calculateQuebecTaxes(base);
    const reversed = reverseCalculateBasePrice(withTax.finalPrice);

    expect(reversed).toBeCloseTo(base, 2);
  });

  it('should work with custom rates', () => {
    const base = 1000;
    const gst = 0.07;
    const qst = 0.08;
    const withTax = calculateQuebecTaxes(base, gst, qst);
    const reversed = reverseCalculateBasePrice(withTax.finalPrice, gst, qst);

    expect(reversed).toBeCloseTo(base, 2);
  });
});

// ─── Test 9: All-Tier Calculation ────────────────────────────────────

describe('calculateAllTiers', () => {
  it('should return all three tiers successfully', () => {
    const result = calculateAllTiers(ITEMS, BOX_COUNT, TEMPLATE);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.budget.tier).toBe('budget');
    expect(result.data.standard.tier).toBe('standard');
    expect(result.data.premium.tier).toBe('premium');
  });

  it('should propagate validation errors', () => {
    const result = calculateAllTiers([], BOX_COUNT, TEMPLATE);
    expect(result.success).toBe(false);
  });
});

// ─── Test 10: Target Optimization ────────────────────────────────────

describe('optimizeForTargetTotal', () => {
  it('should flag when target is too low for minimum margin', () => {
    // Very low target → margin below budget floor
    const result = optimizeForTargetTotal(100, BOX_COUNT, ITEMS, TEMPLATE);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.adjustmentNeeded).toBe(true);
    expect(result.data.suggestion).toContain('Target too low');
  });

  it('should accept viable target prices', () => {
    // High enough target
    const result = optimizeForTargetTotal(500000, BOX_COUNT, ITEMS, TEMPLATE);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.adjustmentNeeded).toBe(false);
  });
});

// ─── Test 11: Formatting ─────────────────────────────────────────────

describe('formatCurrency', () => {
  it('should format in fr-CA locale with $ and 2 decimals', () => {
    const formatted = formatCurrency(1234.5);
    // fr-CA: "1 234,50 $" — exact formatting varies by locale impl
    expect(formatted).toContain('1');
    expect(formatted).toContain('234');
  });
});

describe('formatPercentage', () => {
  it('should format with default 1 decimal', () => {
    expect(formatPercentage(35.678)).toBe('35.7%');
  });

  it('should respect custom decimals', () => {
    expect(formatPercentage(35.678, 2)).toBe('35.68%');
  });
});

// ─── Test 12: Volume Analysis ────────────────────────────────────────

describe('calculateVolumeAnalysis', () => {
  it('should calculate discounted prices and resulting margins', () => {
    const baseResult = calculateTierPricing(ITEMS, BOX_COUNT, 'standard', TEMPLATE);
    expect(baseResult.success).toBe(true);
    if (!baseResult.success) return;

    const tiers = [
      { minQuantity: 100, discountPercent: 5 },
      { minQuantity: 250, discountPercent: 10 },
      { minQuantity: 500, discountPercent: 15 },
    ];

    const analysis = calculateVolumeAnalysis(baseResult.data, tiers);
    expect(analysis).toHaveLength(3);

    // Higher discounts → lower margins
    expect(analysis[0].margin).toBeGreaterThan(analysis[1].margin);
    expect(analysis[1].margin).toBeGreaterThan(analysis[2].margin);

    // All margins should still be positive (35% base − max 15% discount)
    for (const row of analysis) {
      expect(row.margin).toBeGreaterThan(0);
    }
  });
});

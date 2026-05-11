# IRAP — Pricing Engine Extraction ADR-002

> **ADR ID:** ADR-SQ-002  
> **Status:** Accepted  
> **Date:** 2026-02-24  
> **Decision Makers:** NzilaOS Engineering  
> **IRAP Reference:** Technological uncertainty — deterministic jurisdictional pricing

---

## Context

The legacy Shop Quoter Tool V1 contains pricing logic in
`src/lib/margin-solver.ts` that calculates Quebec-compliant pricing
with GST (5%) and QST (9.975%). This logic was entangled with:

- Supabase database queries in `advanced-quoting-engine.ts`
- AI-assisted pricing in `ai-quoting-service.ts`
- Hardcoded markups in `bundle-service.ts` (40% markup)
- Hardcoded tax rates in `purchase-order-service.ts` (15%)

### Technical Uncertainty

It was uncertain whether the pricing logic could be:

1. Extracted as a pure-function engine without data loss
2. Made deterministic across different rounding modes
3. Extended to support configurable governance thresholds
4. Verified against Quebec Revenue Agency rules for QST calculation order

---

## Decision

**Extract all pricing math into `@nzila/pricing-engine`** as a zero-dependency
package with pure functions and typed results.

### Key Implementation

From `packages/pricing-engine/src/pricing-engine.ts`:

```typescript
// Quebec tax rule: QST is calculated on (base + GST)
const gstAmount = priceBeforeTax * template.gstRate        // 5%
const qstAmount = (priceBeforeTax + gstAmount) * template.qstRate  // 9.975%
```

### Public API

| Function | Purpose | Purity |
|----------|---------|--------|
| `calculateTierPricing()` | Full COGS → margin → tax calculation for one tier | Pure |
| `calculateAllTiers()` | Budget + Standard + Premium in one call | Pure |
| `validateMarginFloor()` | Check margin against governance floor | Pure |
| `calculateBreakEven()` | Break-even analysis with recommended price | Pure |
| `optimizeForTargetTotal()` | Reverse-calculate required price for target total | Pure |
| `calculateQuebecTaxes()` | Standalone Quebec GST+QST calculation | Pure |
| `reverseCalculateBasePrice()` | Back-out taxes from final price | Pure |
| `calculateVolumeAnalysis()` | Volume discount impact across tiers | Pure |

### Type System

All inputs and outputs are readonly interfaces:

- `PricingItem` — input item (productId, quantity, unitCost)
- `PricingTemplate` — configurable margins, costs, tax rates
- `MarginCalculation` — full output with every cost component
- `PricingResult<T>` — discriminated union (success/error)

---

## Resolution of Uncertainty

1. **Extraction was successful** — `margin-solver.ts` was cleanly separable
   from DB-coupled files. The 4 entangled files (`advanced-quoting-engine.ts`,
   `ai-quoting-service.ts`, `bundle-service.ts`, `purchase-order-service.ts`)
   were not extracted; their logic will be rebuilt using NzilaOS patterns.

2. **Determinism achieved** — all calculations use standard IEEE 754 floating
   point. The `PricingResult<T>` type forces callers to handle errors.

3. **Governance integration** — `validateMarginFloor()` connects to
   `@nzila/commerce-governance` gates for configurable per-org thresholds.

4. **QRA compliance verified** — the QST calculation order
   (`QST = (base + GST) × 9.975%`) matches Quebec Revenue Agency rules
   and is tested in `pricing-engine.test.ts`.

---

## Consequences

**Positive:**

- Single source of truth for all pricing calculations
- Testable without database or external services  
- Configurable per-org via `PricingTemplate`
- Formal verification of margin floors before quote acceptance

**Negative:**

- Volume discount logic is simplified (step function, not continuous curve)
- Legacy bundle markup (40%) not carried forward (replaced by tier system)

---

*Part of [NzilaOS Commerce Engine](../README.md) | IRAP Project File*

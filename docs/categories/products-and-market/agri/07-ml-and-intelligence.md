# Agri Stack — ML and Intelligence

## Intelligence Layer Architecture

The `@nzila/agri-intelligence` package provides deterministic computation models with pluggable ML model support for future enhancement.

### V1 — Deterministic Models

All V1 models are pure functions with no external API dependencies.

#### 1. Yield Efficiency

```
Yield_Efficiency = Actual_Yield / Expected_Yield
```

- `Actual_Yield` = sum of delivered weights for a crop/season/region
- `Expected_Yield` = baseline prediction

#### 2. Expected Yield Model

```
Expected_Yield = Baseline_By_Crop_Region_Season × Adjustment_Factors
```

- `Baseline_By_Crop_Region_Season` = lookup table from `agri_crops.baseline_yield_per_hectare`
- `Adjustment_Factors` = configurable multipliers (soil, elevation, historical performance)

#### 3. Loss Rate

```
Loss_Rate = (Harvested_Weight - Delivered_Weight) / Harvested_Weight
```

- `Harvested_Weight` = sum of all harvest records for a lot
- `Delivered_Weight` = lot total weight after aggregation and quality deductions

#### 4. Payout Simulation

```
Producer_Payout = Lot_Revenue × (Producer_Weight / Total_Lot_Weight)
```

- Pro-rata distribution based on contribution weight
- Sensitivity analysis: vary revenue ±10%, ±20% to show payout ranges

### Provider Interfaces (Pluggable ML)

```typescript
interface YieldModelProvider {
  predict(input: YieldModelInput): Promise<YieldPrediction>
}

interface PricingSignalProvider {
  getCurrentPrice(crop: string, market: string): Promise<PriceSignal>
  getHistoricalPrices(crop: string, market: string, range: DateRange): Promise<PriceSignal[]>
}

interface ClimateRiskProvider {
  assessRisk(region: GeoPoint, season: string): Promise<ClimateRiskScore>
}
```

V1 implementations use deterministic lookups. V2+ can swap in ML models via `@nzila/ml-sdk`.

### Intelligence Output Tables

| Table | Written By | Purpose |
|-------|-----------|---------|
| `agri_forecasts` | Cora | Yield/price/demand predictions |
| `agri_price_signals` | Cora | Market price observations |
| `agri_risk_scores` | Cora | Climate/market/operational risk scores |

### Computation Schedule

| Metric | Frequency | Trigger |
|--------|-----------|---------|
| Yield efficiency | On demand + daily | Dashboard load or cron |
| Loss rate | On batch creation | Event-driven |
| Price signals | Daily | Scheduled job |
| Risk scores | Weekly | Scheduled job |
| Payout simulation | On demand | User-triggered |

## Future ML Integration

When ML models are ready:

1. Register model in `@nzila/ml-core` model registry
2. Create provider implementation using `@nzila/ml-sdk`
3. Swap provider in `agri-intelligence` configuration
4. Model outputs are validated against deterministic baseline
5. Drift monitoring via `@nzila/ml-core` drift detector

This ensures ML models can be progressively adopted without breaking the deterministic baseline.

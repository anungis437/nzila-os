# Predictions Analytics

This module provides predictive analytics for the portfolio.

## Modules

- `revenue_forecast.py` - ARR/MRR projections
- `churn_prediction.py` - Customer churn models
- `migration_timeline.py` - Migration effort estimation
- `market_expansion.py` - Market opportunity scoring

## Usage

```bash
# Generate revenue forecast
python -m analytics.predictions.revenue_forecast --year 2026

# Predict churn
python -m analytics.predictions.churn_prediction

# Estimate migration timeline
python -m analytics.predictions.migration_timeline
```

## Predictive Models

### Revenue Forecasting
- 5-year ARR projection model
- MRR growth curves by platform
- Scenario analysis (base, optimistic, conservative)

### Churn Prediction
- Platform-specific churn rates
- Retention drivers
- Intervention triggers

### Migration Estimation
- Platform complexity scoring
- Dependency mapping
- Resource allocation

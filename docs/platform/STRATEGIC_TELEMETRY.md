# Strategic Telemetry (Quarterly)

## Purpose

Track whether governance and platform investments are improving adoption, cost accountability, and delivery performance.

## Required Metrics

| Domain | Metric | Target |
|---|---|---|
| Adoption | Pilot to Production conversion rate | Up and to the right QoQ |
| Cost | Cost attribution coverage (apps/orgs with mapped spend) | >= 95% mapped |
| Delivery | Lead time for change (p50/p95) | Improving trend QoQ |
| Delivery | Change failure rate | Stable or decreasing QoQ |
| Governance | Governance gate pass rate | >= 98% |

## Data Inputs

- `platform/registry/apps.json` (app tier distribution)
- `reports/coverage/dashboard.json` (coverage trend context)
- `ops/outputs/cost-allocation.json` (optional, for cost attribution)
- `ops/outputs/dora-metrics.json` (optional, for lead time/change failure)

## Generator

Run:

```bash
pnpm strategic:quarterly
```

Outputs:

- `reports/strategy/quarterly-scorecard.md`
- `reports/strategy/quarterly-scorecard.json`

## Governance Use

- Reviewed by Platform + Security + Engineering leadership each quarter.
- Feed outcomes into backlog prioritization and gate tuning.

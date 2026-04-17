---
title: Strategic Telemetry
description: Quarterly telemetry model for adoption, cost accountability, delivery performance, and governance health.
category: Technical
order: 7
date: 2026-04-16
---

## Purpose

Strategic telemetry tracks whether platform and governance investments are improving adoption, cost accountability, and delivery performance.

## Required Metrics

| Domain | Metric | Target |
|---|---|---|
| Adoption | Pilot to Production conversion rate | Up and to the right QoQ |
| Cost | Cost attribution coverage (apps/orgs with mapped spend) | >= 95% mapped |
| Delivery | Lead time for change (p50/p95) | Improving trend QoQ |
| Delivery | Change failure rate | Stable or decreasing QoQ |
| Governance | Governance gate pass rate | >= 98% |

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
- Feeds backlog prioritization and gate tuning.

## Review Cadence

- Weekly: monitor leading indicators (lead time, gate failures, attribution coverage).
- Monthly: validate signal quality and adjust metric definitions where needed.
- Quarterly: decide investment shifts, risk posture updates, and delivery targets.

## Interpretation Guidance

- Evaluate trend direction over multiple periods instead of single-point snapshots.
- Pair delivery metrics with governance metrics to avoid speed-at-all-costs behavior.
- Treat unexplained telemetry gaps as incidents; missing data is a governance risk.

## Source of Truth

This public summary mirrors `docs/platform/STRATEGIC_TELEMETRY.md`.

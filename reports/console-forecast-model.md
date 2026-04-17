# Console Forecast Model

## Scope

Forecasts 30/90/180-day trajectory for revenue and runway under best/base/worst assumptions.

## Core mechanics

- Pipeline weighted value derived from quote statuses.
- Base scenario anchored to runway base mode.
- Best scenario assumes close-rate lift and lower overload drag.
- Worst scenario assumes stale opportunities and persistent context-switch drag.

## Outputs

- Runway months by scenario
- Revenue expectations at 30/90/180 days
- Founder overload risk percentage
- Hiring affordability estimate
- Ranking-shift signal summary

## Current limits

- Uses fixed status weights rather than dynamic posterior probabilities.
- Should ingest time-series close accuracy to improve confidence intervals.
- Should eventually include seasonality and venture-specific lead times.

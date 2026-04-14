# Pilot Metrics Architecture

## Purpose
The pilot metrics subsystem provides proof-grade, org-scoped pilot visibility for Union Eyes and Zonga pilots without creating a separate analytics platform.

## Core Components
- `@nzila/platform-pilot-metrics-types`: canonical taxonomy, event/report contracts.
- `@nzila/platform-pilot-metrics`: ingestion, rollups, scoring, alerts, report exports.
- DB schema: `pilot_definitions`, `pilot_metric_events`, `pilot_metric_rollups`, `pilot_health_scores`, `pilot_alerts`.
- Control Plane APIs/UI: `/api/control-plane/pilot-metrics/*` and dashboard pages under `/pilots/*`.

## Canonical Metric Taxonomy
- Platform: active users, sessions, latency, error, uptime, integration/workflow failures.
- Adoption: DAU/WAU, repeat usage, time-to-first-value, onboarding completion.
- Union Eyes: case/SLA/evidence/workflow metrics.
- Zonga: events/tickets/stream/engagement metrics.
- Revenue: gross/net/platform fee/subscription/transactions/refunds/failures.
- Integration: inbound/outbound/retry/dead-letter/mapping/sync-latency.

## Data Flow
1. App routes/actions call pilot metric adapters (`apps/union-eyes/lib/pilot-metrics.ts`, `apps/zonga/lib/pilot-metrics.ts`).
2. Adapter resolves active pilot for `org_id + app_scope`.
3. Adapter records append-only events in `pilot_metric_events` through `recordPilotMetricEvent()`.
4. Rollup job/API computes metric windows (`hour/day/week`) into `pilot_metric_rollups`.
5. Health score computation writes weighted scores to `pilot_health_scores`.
6. Alert engine writes threshold/risk alerts to `pilot_alerts`.
7. Control Plane reads summaries directly from rollups/health/alerts.

## Scoring Model
Scoring dimensions:
- adoption
- operational value
- reliability
- revenue
- workflow compliance

Profiles:
- `enterprise-workflow`: ops/workflow weighted higher.
- `event-creator`: revenue/adoption weighted higher.

## Alert Logic
Current rules include:
- low adoption
- SLA breach spikes
- error-rate spikes
- stream failure pattern
- revenue mismatch
- integration dead-letter threshold

## Governance Rules
- Org-scoped and pilot-scoped writes only.
- Pilot APIs require Control Plane API auth.
- Pilot events are append-only.
- Audit linkage recorded in `audit_log` for event ingestion.
- No seeded/fabricated values in pilot metrics paths.

## Exports
`exportPilotReport()` supports:
- JSON (full pilot proof package)
- CSV (rollups)
- Markdown (executive narrative)

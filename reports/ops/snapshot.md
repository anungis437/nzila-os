# Operational Evidence Snapshot

> Generated: 2026-11-14T05:14:37.426Z
> GitHub build metrics were queried now. Historical August DORA and cost inputs are excluded; unmeasured fields remain null.

| Metric | Value | Source |
|---|---:|---|
| deploy_frequency_30d | null | ops/outputs/dora-metrics.json: metrics.deployment_frequency.value (deploys/week) |
| build_success_rate_30d | 6.06 | GitHub Actions API ci.yml runs on main (30d window, completed runs: 66) |
| median_build_minutes | 20.65 | GitHub Actions API ci.yml runs on main (30d window, completed runs: 66) |
| change_failure_rate_30d | null | ops/outputs/dora-metrics.json: metrics.change_failure_rate.value |
| mttr_minutes | null | ops/outputs/dora-metrics.json: metrics.mttr.value (hours -> minutes) |
| uptime_30d | null | Azure Monitor / Application Insights uptime SLO exporter |
| p50_latency_ms | null | Application Insights latency export |
| p95_latency_ms | null | Application Insights latency export |
| auth_success_rate | null | platform-auth auth event rollup |
| error_rate | null | Application Insights / Sentry error metric export |
| monthly_infra_cost_estimate | null | ops/outputs/cost-allocation.json: total_monthly_cost_usd |
| incidents_last_30d | null | Incident registry export (GitHub issues/PagerDuty) |

## Missing Source Wiring

- deploy_frequency_30d: Committed input was collected 2026-08-25 and does not measure the current reporting window; collect a current export.
- change_failure_rate_30d: Committed input was collected 2026-08-25 and does not measure the current reporting window; collect a current export.
- mttr_minutes: Committed input was collected 2026-08-25 and does not measure the current reporting window; collect a current export.
- uptime_30d: No committed uptime export in repository. Wire Azure Monitor export to ops/outputs/uptime.json.
- p50_latency_ms: No committed route latency export found. Publish p50/p95 rollup to ops/outputs/latency.json.
- p95_latency_ms: No committed route latency export found. Publish p50/p95 rollup to ops/outputs/latency.json.
- auth_success_rate: No auth rollup artifact found. Add monthly auth success export to ops/outputs/auth-metrics.json.
- error_rate: No error-rate rollup artifact found. Add monthly app error export to ops/outputs/error-rate.json.
- monthly_infra_cost_estimate: Committed input was collected 2026-08-25 and does not measure the current reporting window; collect a current export.
- incidents_last_30d: No incident registry artifact found in repository for 30d count.

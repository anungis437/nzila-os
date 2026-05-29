# Operational Evidence Snapshot

> Generated: 2026-05-29T22:57:45.059Z
> Policy: fields without measurable evidence remain null and include source_needed.

## Metrics (30-day window unless noted)

| Metric | Value | Unit | Source |
|---|---:|---|---|
| deploy_frequency_30d | 10.7 | deploys/week | ops/outputs/dora-metrics.json: metrics.deployment_frequency.value (deploys/week) |
| build_success_rate_30d | null | % | GitHub Actions API (not available in current execution context) |
| median_build_minutes | null | minutes | GitHub Actions API (not available in current execution context) |
| change_failure_rate_30d | 0 | % | ops/outputs/dora-metrics.json: metrics.change_failure_rate.value |
| mttr_minutes | 0 | minutes | ops/outputs/dora-metrics.json: metrics.mttr.value (hours -> minutes) |
| uptime_30d | null | % | Azure Monitor / Application Insights uptime SLO exporter |
| p50_latency_ms | null | ms | Application Insights latency export |
| p95_latency_ms | null | ms | Application Insights latency export |
| auth_success_rate | null | % | platform-auth auth event rollup |
| error_rate | null | % | Application Insights / Sentry error metric export |
| monthly_infra_cost_estimate | null | USD/month | ops/outputs/cost-allocation.json: total_monthly_cost_usd |
| incidents_last_30d | null | count | Incident registry export (GitHub issues/PagerDuty) |

## Missing Source Wiring

- build_success_rate_30d: Set GITHUB_TOKEN/GH_TOKEN and GITHUB_REPOSITORY to query GitHub Actions build history.
- median_build_minutes: Set GITHUB_TOKEN/GH_TOKEN and GITHUB_REPOSITORY to query GitHub Actions build history.
- uptime_30d: No committed uptime export in repository. Wire Azure Monitor export to ops/outputs/uptime.json.
- p50_latency_ms: No committed route latency export found. Publish p50/p95 rollup to ops/outputs/latency.json.
- p95_latency_ms: No committed route latency export found. Publish p50/p95 rollup to ops/outputs/latency.json.
- auth_success_rate: No auth rollup artifact found. Add monthly auth success export to ops/outputs/auth-metrics.json.
- error_rate: No error-rate rollup artifact found. Add monthly app error export to ops/outputs/error-rate.json.
- monthly_infra_cost_estimate: Run pnpm collect:cost with Azure API enabled to populate real monthly cost.
- incidents_last_30d: No incident registry artifact found in repository for 30d count.

## Inputs Used

- ops/outputs/dora-metrics.json
- ops/outputs/cost-allocation.json
- GitHub Actions API (when token/repo context is available)

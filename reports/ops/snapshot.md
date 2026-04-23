# Operational Evidence Snapshot

> Generated: 2026-04-22T21:00:00.000Z (ops pass — github-actions-api + azure-cli probes)
> Policy: fields without measurable evidence remain null with explicit source_needed.

## Metrics (30-day window unless noted)

| Metric | Value | Unit | Source |
|---|---:|---|---|
| deploy_frequency_30d | 10 | deployments | GitHub Actions Deploy/GitOps workflows, 30d window |
| build_success_rate_30d | 81.5 | % | GitHub Actions: 163/200 completed runs succeeded (30d) |
| median_build_minutes | 41 | minutes | GitHub Actions CI run durations, sampled |
| change_failure_rate_30d | 0 | % | No rollback events or hotfixes recorded |
| mttr_minutes | null | minutes | No incident tracker integration configured |
| uptime_30d | null | % | Azure Monitor SLO export not configured |
| p50_latency_ms | null | ms | Application Insights export not configured |
| p95_latency_ms | null | ms | Application Insights export not configured |
| auth_success_rate | null | % | platform-auth event rollup not exported |
| error_rate | null | % | Application Insights export not configured |
| monthly_infra_cost_estimate | null | USD/month | Azure Cost Management not queried |
| incidents_last_30d | 0 | count | GitHub issues: no 'incident' label found in 30d |

## Service Health (2026-04-22 HTTPS probe)

| Domain | HTTP | TLS | Status |
|---|---|---|---|
| nzilaventures.com | 200 | valid | operational |
| console.nzilaventures.com | 200 | valid | operational |
| partners.nzilaventures.com | 200 | valid | operational |
| unioneyes.app | 200 | valid | operational |

## Missing Source Wiring

- mttr_minutes: Incident tracker integration required.
- uptime_30d: Wire Azure Monitor export to ops/outputs/uptime.json.
- p50_latency_ms / p95_latency_ms: Publish Application Insights rollup to ops/outputs/latency.json.
- auth_success_rate: Add monthly auth success export to ops/outputs/auth-metrics.json.
- error_rate: Add monthly app error export to ops/outputs/error-rate.json.
- monthly_infra_cost_estimate: Run `az consumption usage list` with subscription scope.

## Inputs Used

- GitHub Actions API (`gh run list --repo anungis437/nzila-os`)
- Azure CLI (`az storage account keys list`, `az containerapp show`)
- HTTPS probe (Invoke-WebRequest on production domains)

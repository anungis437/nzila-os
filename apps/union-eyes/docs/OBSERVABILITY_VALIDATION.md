# UnionEyes — Observability Validation (B3C)

## What is live

| Surface | Resource | Status | Notes |
|---|---|---|---|
| Log Analytics workspace | `nzila-canada-prod-law` | configured | PerGB2018 SKU, 90-day retention, `Succeeded` provisioning state |
| Container App logs | `nzila-os-union-eyes-prod` → LAW | configured (assumed) | ACA env diagnostic settings should pipe stdout/stderr to LAW; confirm via `az monitor diagnostic-settings list` per resource |
| Container App revision metrics | Azure built-in | configured | Available via Azure Portal → Container App → Metrics |
| Health endpoint contract | `/api/health` | validated | Live capture returned HTTP 200, status `degraded`, with per-dep `ms` field for DB latency |

## What is missing / unconfirmed

- **Application Insights component**: not present in `nzila-canada-prod-rg`.
  UE telemetry routing (OTel exporter target) needs to be confirmed —
  either explicit AI component to be provisioned, or LAW-only routing
  to be declared the official design.
- **Sentry**: DSN env var expected; live event ingestion not verified in
  this pass.
- **OTel traces**: distributed-trace ingestion against the LAW workspace
  not verified.
- **Dashboards**: no Azure dashboard / workbook artifact referenced from
  this doc yet. To mark `validated` we need at minimum:
  - UE prod health timeseries
  - UE prod request volume + latency
  - UE prod DB connection pool / replica lag
  - Governance event rate
  - Evidence export rate
- **Alert rules**: not enumerated in this pass. Add KQL alert
  definitions covering: health 503 sustained, p95 latency breach,
  governance event drop-to-zero, Sentry error rate spike.

## Validation gate

Mark `validated` only when:

1. LAW shows real UE prod log volume in a 24h window.
2. At least one alert rule has fired and been acknowledged in a drill.
3. A workbook / dashboard reference is linked from this doc and is
   usable by an operator other than the founder.

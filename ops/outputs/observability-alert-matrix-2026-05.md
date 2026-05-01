# Observability and Alert Matrix — May 2026

Generated: 2026-05-01
Period: 2026-05

## Alert Inventory Summary

Commands used:
- az monitor metrics alert list --resource-group nzila-canada-staging-rg
- az monitor metrics alert list --resource-group nzila-staging-rg
- az monitor scheduled-query list --resource-group nzila-canada-staging-rg

Results:
- Metric alerts found: 3
- Scheduled query alerts found: 0

## Active Metric Alerts

| Alert Name | Severity | Enabled | Resource Scope | Area |
|------------|----------|---------|----------------|------|
| zonga-cpu-high | Sev2 | true | Microsoft.App/containerapps/nzila-os-zonga | Workload performance |
| zonga-5xx-errors | Sev1 | true | Microsoft.App/containerapps/nzila-os-zonga | Application reliability |
| zonga-db-connections-high | Sev2 | true | Microsoft.DBforPostgreSQL/flexibleServers/nzila-staging-db | Database saturation |

## Coverage Assessment

Current alert coverage is concentrated on Zonga service and its DB dependency path. This is useful but incomplete for full platform operations.

Missing or not yet discovered as active alerts:
- web latency/error budget alerts
- console/control-plane availability alerts
- union-eyes application and health endpoint alerts
- generic ACA revision crashloop/restart spike alerts
- storage account availability/latency alerts
- backup job failure alerts

## Operational Risk

- Single-domain alert concentration (mostly Zonga) increases detection risk for issues in other production-approved services.
- No scheduled-query alerts currently configured in nzila-canada-staging-rg.

## Recommended Next Alert Additions

Priority P1:
- production web 5xx rate and p95 latency
- production partners availability and 5xx
- production union-eyes root and health endpoint failure
- control-plane availability and authentication failure rate

Priority P2:
- PostgreSQL storage threshold and replication/backup failure events
- Container Apps restart/crash anomaly per critical app
- Certificate expiration and DNS drift checks for custom domains

## Gate Alignment

Current runtime gate remains unaffected because health checks pass and proof dimensions are complete.

Alert maturity is below ideal target for controlled production operations; this is a hardening opportunity, not a current gate blocker.

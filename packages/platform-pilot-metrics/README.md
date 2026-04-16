# @nzila/platform-pilot-metrics

Pilot proof metrics service layer for ingestion, rollups, alerts, and reporting.

## Owns

- Pilot metrics ingestion and metric rollup workflows
- Health score computation and pilot alert evaluation
- Reporting services for pilot operational readiness

## Does Not Own

- UI rendering of pilot dashboards
- Product-specific KPI definitions outside shared pilot contracts

## Use This When

- Computing pilot metrics and readiness indicators across apps
- Building pilot health alerts and rollup reports
- Persisting governed pilot metrics through shared services

## Adjacent Packages

- @nzila/platform-pilot-metrics-types: shared pilot metrics contracts
- @nzila/platform-observability: observability and monitoring primitives

# Data Retention Policy (Operational)

## Purpose

Define baseline retention expectations for operational, audit, and commercial records in Nzila OS.

## Data Classes

1. Security and Audit Events

- Includes auth events, orchestrator events, and governance evidence metadata.
- Retention target: minimum 24 months unless legal hold requires longer.

2. Commercial and Pilot Records

- Includes pilot definitions, pilot metric events, quote and opportunity history.
- Retention target: minimum 24 months for trend and conversion analysis.

3. Operational Metrics

- Includes aggregated dashboards and derived monitoring snapshots.
- Retention target: minimum 12 months rolling for operational tuning.

4. Support and Incident Artifacts

- Includes incident timelines, remediation notes, and escalations.
- Retention target: minimum 24 months.

## Deletion and Archival Principles

- Follow tenant and legal obligations before destructive deletion.
- Prefer archive over delete for governance-critical records.
- Retention changes must be approved through governance review.

## Evidence

- Schema references: packages/db/src/schema/
- Related docs:
  - docs/governance/audit-logging-model.md
  - docs/governance/incident-response-summary.md

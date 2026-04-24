# Audit Logging Model

## Purpose

Explain how Nzila OS produces traceable operational and governance records.

## Logging Domains

1. Workflow Execution Logs

- Source: orchestrator command and event lifecycle tables
- Use: track dispatch, state transitions, failures, retries, and completion

2. Pilot and Commercial Metrics Logs

- Source: pilot metric events and rollups
- Use: adoption, health scoring, and conversion signals

3. Application and API Logs

- Source: app-level telemetry and request logging
- Use: debugging, operational diagnostics, and trend analysis

## Integrity and Traceability

- Correlation IDs are used across workflow boundaries where implemented.
- Idempotency keys reduce duplicate workflow side effects.
- Governance docs define claim boundaries for enterprise readiness statements.

## Access and Control

- Audit records are scoped by organization where applicable.
- Access is limited to authorized operators and support roles.

## Related References

- packages/db/src/schema/automation.ts
- packages/db/src/schema/pilot-metrics.ts
- docs/proof-center/

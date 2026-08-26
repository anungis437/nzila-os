# 04 — Observability and Alerting (G12, read-only)

## Telemetry pipeline

- SAGE observability is designed around OpenTelemetry/OTLP export to Azure
  Monitor / Log Analytics.
- Log Analytics workspace `nzila-staging-logs` (RG `nzila-staging-rg`) exists.
  Using the `log-analytics` az CLI extension, a harmless KQL query was executed:

  ```
  Heartbeat | take 1 | project Computer, TimeGenerated
  -- result: [] (empty)
  ```

  Record separately:

  ```
  Log Analytics resource presence: PASS
  KQL query authorized:            PASS (query executed without auth error)
  Query returned data:             NO DATA (empty Heartbeat — no agent telemetry)
  SAGE telemetry present:          ABSENT (no deployed SAGE surface)
  PII scrubbing:                   NOT_PROVEN (no controlled SAGE event emitted)
  ```

- No SAGE telemetry flows in staging because the deployed image is pre-SAGE. A
  live telemetry round-trip (emit synthetic event → ingest → query → verify
  correlation id and PII scrubbing) could **not** be executed.

## Alerting and delivery

- The only staging action group, `zonga-ops-alerts`, has **0 email / 0 SMS /
  0 webhook** receivers — no operator delivery channel. It was **not** modified.
- Existing alert rules (`zonga-cpu-high`, `zonga-5xx-errors`) are ZONGA-scoped;
  there are no SAGE/platform-admin alert rules.
- No `sage-proof-alerts` action group was created: that requires an approved
  receiver and a named operator to confirm receipt, neither available this run.

## Incident drill

- The G12 incident drill (deny/misconfigure Redis on a running SAGE surface;
  observe fail-closed, detect, alert, ack, mitigate, recover, verify audit) was
  **not** performed — it requires a deployed SAGE surface, a configured alert
  channel, and a named operator.

## Status

**G12 — NOT_PROVEN.** Query authorization and backend reachability are
established, but the end-to-end telemetry round-trip, alert routing to a human,
and the incident drill remain unproven. Blockers **B-001** (observability wiring)
and **B-002** (incident alerting and drill) remain open BLOCKERs.

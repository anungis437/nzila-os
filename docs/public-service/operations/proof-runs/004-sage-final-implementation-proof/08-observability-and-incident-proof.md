# 08 — Observability and Incident-Response Proof

## Status: NOT_PROVEN (no monitoring infrastructure provisioned in this proof environment)

This proof environment did not provision Sentry / error monitoring, an external uptime
monitor, or alert routing. The items below therefore cannot be honestly marked PASS.

| Requirement | Code/design present | Live proof |
|---|---|---|
| Error monitoring receives a controlled safe test event | OTLP/structured error events emitted (observed as `[OTLP] Export error: fetch failed` when no collector configured — confirming the export path exists and fails safe) | NOT_PROVEN |
| PII scrubbing active; tokens/recipient addresses excluded | logs are structured with `tenant_id`/`actor_id`/`request_id` only; no address/token fields | PARTIAL — design proven, live scrub NOT_PROVEN |
| External uptime monitor observes readiness surfaces | internal/public readiness routes exist in code | NOT_PROVEN |
| Alert routing reaches designated operator | not configured | NOT_PROVEN |
| Notification backlog / destruction-failure / dead-letter metrics visible | counts computed in code (safe aggregates) | NOT_PROVEN (no dashboard/collector) |

## Incident-response drill

A live incident-response drill (provider outage, Redis outage, storage verification
failure, DB interruption) requires provisioned infrastructure and a monitoring/alerting
stack. **NOT_PROVEN** in this environment.

Partial, honest signal from executed tests: the **fail-safe behaviours** an incident
would rely on are proven in code — the rate limiter fails closed, decryption failures
dead-letter, delete-success without verified absence does not tombstone, and missing
`DATABASE_URL` fails closed at boot. These prove the *safety* properties an incident
would exercise, but not detection/alerting/recovery against live infrastructure.

## Verdict

Gate G12 = **NOT_PROVEN**. This is a critical gate; per launch rules its NOT_PROVEN
status mandates a NO_GO until proven in a deployed environment with real monitoring.

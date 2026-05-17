# UnionEyes — Governance Runtime Model

> How governance events flow through the running process and out to observability sinks.

## 1. Emission

Any code path that needs to record a governance event imports `governanceEmitter` from `@nzila/governance-middleware` and calls `.emit(envelope)`. Envelopes are typed and include:

- `event_type` (e.g., `policy.evaluated`, `grievance.escalated`)
- `tenant_id` (organization_id)
- `actor_id`
- `release_id` (bound at boot)
- `environment_class` (bound at boot)
- `payload` (typed per event_type)
- `occurred_at`

## 2. Binding (at boot)

`apps/union-eyes/lib/governance/runtime.ts → bindGovernanceRuntime()` is called from `instrumentation.ts` during the Node.js runtime register pass. It registers two sinks:

1. **OTel sink** — `emitGovernanceSpan` from `@nzila/governance-otel` emits the envelope as a span on the active tracer. This is what Azure Monitor and other backends ingest.
2. **In-memory mirror** — `InMemoryGovernanceSink` retains the last N envelopes for E2E test assertions (`apps/union-eyes/e2e/**` can call `__governanceMirror()`).

## 3. Aggregation (at request time)

`/api/governance/telemetry` reads:

- `governance_events` table for `audit_event_volume`
- `policy_evaluations` table for `policy_denied_count` (denied OR not-passed)
- Process-local counters for `workflow_transition_error_count`, `evidence_export_count`, `auth_anomaly_count`

Aggregation is intentionally **platform-wide** (not per-tenant) so operators can read a single number. Per-tenant breakdowns belong in tenant dashboards, not in the operational telemetry endpoint.

## 4. Identity binding

`NZILA_RELEASE_ID` and `NZILA_ENVIRONMENT_CLASS` are read at boot once and stamped on every envelope. This makes it trivial to filter envelopes by deployment in observability tooling.

## 5. Edge-runtime safety

`lib/governance/runtime.ts` MUST NOT be imported from `proxy.ts` (edge middleware). The OTel adapter pulls in `node:crypto`, which the edge runtime cannot resolve. The `bindGovernanceRuntime()` call is guarded by `process.env.NEXT_RUNTIME === 'nodejs'`.

## 6. Failure modes

| Failure | Behaviour |
|---|---|
| OTel sink throws | Caught; envelope still mirrors to in-memory sink. |
| In-memory sink throws | Caught silently (last-resort). |
| `bindGovernanceRuntime()` fails | Logged as warning; request serving continues. |
| `policy_evaluations` query fails | Endpoint falls back to in-process counter only. |

## 7. Extending

To add a new governance counter:

1. Add a `record<X>()` helper in `apps/union-eyes/app/api/governance/telemetry/route.ts`.
2. Call `record<X>()` from the relevant code path.
3. Add the counter to the JSON response.
4. Document the new counter in `OPS_VALIDATION_CHECKLIST.md`.

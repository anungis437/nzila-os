# Governance Telemetry Live Pipeline

> **Status:** Canonical runtime integration · **Layer:** Telemetry execution · **Inherits:** [governance-telemetry-architecture.md](../nzila-runtime-governance/governance-telemetry-architecture.md)

## 1. Objective

Operate a live, restrained, system-scoped governance telemetry pipeline. Every governance-bearing runtime act emits a canonical event envelope; no act in the registry is silent.

## 2. Emission surfaces

| Surface | Events emitted |
|---|---|
| Edge middleware | `governance_event:route_resolution`, `pilot_boundary_event` (on pilot route entry) |
| Layout guards | `continuity_signal:visibility_resolved`, `governance_event:role_resolved` |
| Route handlers | `doctrine_enforcement_event` (per asserted policy), `governance_event:read`, `governance_event:write` |
| AI invocation paths | `ai_governance_event:capability_invoked`, `ai_governance_event:capability_refused` |
| Deployment validation | `deployment_legitimacy_event:checked`, `deployment_legitimacy_event:rejected` |
| Continuity observers | `continuity_signal:posture_observed`, `cognitive_safety_signal:threshold_exceeded` |
| Orchestration adapters | `governance_event:orchestration_handoff` |

## 3. Pipeline shape

1. **Emitter** — products call `governanceEmitter.emit(envelope)` from [@nzila/governance-middleware](../../packages/governance-middleware). The envelope is validated against `governanceEventEnvelopeSchema` at the boundary.
2. **Adapter** — [@nzila/governance-otel](../../packages/governance-otel) maps the envelope to an OpenTelemetry span with semantic governance attributes.
3. **Sink** — spans flow into the existing OTel exporter (`@nzila/os-core/telemetry`). No second pipeline is required.
4. **Ledger** — `critical` envelopes are additionally written to the governance evidence ledger via the runtime-attestation API.

## 4. Anti-surveillance discipline

The pipeline MUST refuse to carry:

- `userId`, `user_id`, `employeeId`, `employee_id`, `email`, `phone`, `sessionId`, `session_id` and any equivalent person-resolving key in `payload`. The schema rejects them at validation time.
- Behavioral counters scoped to individuals.
- Productivity/throughput proxies aggregated to a single human.
- Replay-style payload capture.

These prohibitions are structural. Removing them is a doctrine violation, not a configuration change.

## 5. Restraint

Routine route resolutions emit at `info`. They are sampled aggressively at the OTel layer (default 1%). Doctrine-bearing events (`warning` and `critical`) are never sampled out.

## 6. Discipline

Governance telemetry must be useful, citable, and quiet. Quantity is not signal. Coverage is not value. The pipeline exists to make governance acts attestable, not to render the institution observable as a behavioral substrate.

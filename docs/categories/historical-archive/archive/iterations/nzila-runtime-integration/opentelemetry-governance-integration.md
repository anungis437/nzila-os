# OpenTelemetry Governance Integration

> **Status:** Canonical runtime integration · **Layer:** OTel adapter · **Inherits:** [governance-telemetry-architecture.md](../nzila-runtime-governance/governance-telemetry-architecture.md)

## 1. Objective

Extend the existing OpenTelemetry pipeline (`@nzila/os-core/telemetry`) to carry governance semantics natively, without inventing a parallel observability stack.

## 2. Integration shape

[@nzila/governance-otel](../../packages/governance-otel) exposes:

- `createGovernanceTracer(options)` → returns an OTel `Tracer` whose name is `nzila.governance`.
- `emitGovernanceSpan(envelope)` → opens a span for one canonical event envelope, sets governance attributes, and ends the span.
- `withGovernanceSpan(envelope, fn)` → wraps a function call, recording `decision` and `severity` post-hoc.

The adapter never owns the OTel SDK. It uses whatever provider `@nzila/os-core/telemetry` has registered.

## 3. Span attributes

Each governance span sets:

| Attribute | Source |
|---|---|
| `nzila.governance.event_type` | `envelope.type` |
| `nzila.governance.severity` | `envelope.severity` |
| `nzila.governance.decision` | `envelope.decision` (if present) |
| `nzila.governance.product` | `envelope.scope.product` |
| `nzila.governance.environment_class` | `envelope.scope.environmentClass` |
| `nzila.governance.subject_kind` | `envelope.subject.kind` |
| `nzila.governance.subject_id` | `envelope.subject.id` (system-scoped only) |
| `nzila.governance.release_id` | `envelope.releaseId` |
| `nzila.governance.doctrine_doc` | first citation `document` |
| `nzila.governance.schema_version` | `ENVELOPE_SCHEMA_VERSION` |

The adapter REFUSES to set any attribute whose key matches a forbidden person-resolving payload key. This refusal is structural and matches the schema layer.

## 4. Sampling

- `info` spans inherit the parent sampler (default 1% in production, 100% locally).
- `warning` spans are forced-sampled.
- `critical` spans are forced-sampled and additionally written to the evidence ledger.

## 5. Span hygiene

Governance spans MUST be short, semantically meaningful, and never used to carry payloads that should be in evidence records. If a span attribute would exceed 128 characters, it is dropped in favour of an evidence-record reference.

## 6. Discipline

Governance over OTel is integration, not invention. The institution already runs a tracing pipeline; governance becomes a first-class semantic layer over it. Adding a parallel pipeline would degrade operational calmness and add cost without adding governance value.

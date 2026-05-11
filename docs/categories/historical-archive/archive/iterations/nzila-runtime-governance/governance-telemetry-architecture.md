# Governance Telemetry Architecture

> **Status:** Canonical runtime governance · **Layer:** Telemetry contracts · **Inherits:** [../nzila-assurance/automated-governance-evidence-system.md](../nzila-assurance/automated-governance-evidence-system.md), [../nzila-assurance/governance-evidence-pipeline-architecture.md](../nzila-assurance/governance-evidence-pipeline-architecture.md)

The **governance telemetry architecture** defines the schemas, contracts, normalization, and stream-processing model for all runtime governance signal. It is the wire-level discipline that lets doctrine, observability, attestation, and assurance share a single, stable, anti-surveillance-safe stream.

---

## 1. Posture

The architecture:

- **Specifies** stable, versioned schemas for every governance event class
- **Normalizes** events across products into one shape
- **Constrains** payload to governance-bearing fields only
- **Honors** aggregation stance at the wire
- **Optimizes** for institutional trust, not for maximum visibility
- **Emits** to OpenTelemetry-compatible sinks where transport is available

Telemetry that maximizes visibility without governance discipline is surveillance with extra steps.

---

## 2. Captured Telemetry

| Class | Producer | Examples |
|-------|----------|----------|
| Doctrine enforcement outcomes | Doctrine enforcement engine | `doctrine_violation`, `governance_warning` |
| Deployment legitimacy | Deployment legitimacy engine | `unknown_release_state`, `environment_drift_detected` |
| Environment identity | Environment governance layer | `environment_identity_verified`, `environment_identity_failure` |
| Governance events | Governance review surfaces | `governance_review_recorded`, `governance_decision_emitted` |
| Assurance outcomes | Runtime assurance engine | `assurance_posture_updated` |
| Continuity posture indicators | Continuity observability | `continuity_posture_changed`, `governance_friction_detected` |
| Cognitive governance signals | Executive cognitive monitoring | `cognitive_overload_risk`, `pacing_violation` |
| AI explainability compliance | AI runtime validation | `ai_explainability_failure`, `opaque_recommendation_detected` |
| Modernization safety indicators | Modernization observability | `modernization_pace_violation`, `irreversible_change_detected` |

---

## 3. Event Envelope (canonical)

Every governance event conforms to this envelope (typed in [packages/governance-telemetry](../../packages/governance-telemetry)):

```ts
interface GovernanceEventEnvelope {
  readonly id: string                    // ULID; aggregation-safe
  readonly type: GovernanceEventType
  readonly severity: 'info' | 'warning' | 'critical'
  readonly subject: GovernanceSubject    // route / surface / workflow / environment / release
  readonly scope: GovernanceScope        // product / environment / pilot / org
  readonly doctrineCitation?: DoctrineCitation
  readonly decision?: 'allow' | 'deny' | 'require_approval' | 'require_review'
  readonly environment: string
  readonly release: string
  readonly emittedAt: string             // ISO timestamp
  readonly payload: Record<string, unknown> // governance-bearing only
}
```

Forbidden envelope contents:

- Individual identifiers (user id, employee id, contact id) outside aggregation-safe hashes
- Behavioral profile attributes
- Productivity attribution
- Personal text snippets
- Free-form unbounded payloads

---

## 4. Schema Discipline

- Each event type has a Zod schema
- Schemas are versioned (`type@version`)
- Schema registry lives in [packages/governance-telemetry](../../packages/governance-telemetry)
- Producers must validate before emission
- Consumers must validate on ingestion
- Unknown event types are quarantined, not dropped silently

---

## 5. Normalization

Pipeline normalization (per [governance-evidence-pipeline-architecture](../nzila-assurance/governance-evidence-pipeline-architecture.md)):

1. Validate against registered schema
2. Strip non-governance-bearing fields
3. Apply aggregation stance (collapse user-identifying fields to scope buckets)
4. Bind to release and environment identity
5. Stamp pipeline ingestion metadata
6. Forward to evidence ledger and observability sinks

---

## 6. Stream Processing

Stream processors are doctrine-aware:

- **Suppression** — known-noise events suppressed at processor (with explicit policy id)
- **Aggregation** — windowed aggregation for indicator surfaces
- **Routing** — events route to relevant assurance, observability, and ledger destinations
- **Sampling** — sampling honors aggregation stance; never resolves individuals

Processors run with bounded resource budgets; processor degradation is itself a governance event.

---

## 7. Retention Governance

Retention horizons are class-bound:

| Class | Retention |
|-------|-----------|
| Doctrine enforcement outcomes | Certification window + standing review margin |
| Deployment legitimacy | Release horizon + audit margin |
| Environment identity | Environment lifetime + audit margin |
| Governance events | Doctrine governance forum's archival horizon |
| Assurance outcomes | Standing review horizon |
| Continuity posture indicators | Bounded; aggregated rolls retained, raw streams not |
| Cognitive governance signals | Bounded; recommendation-bearing only |
| AI explainability compliance | AI governance horizon |
| Modernization safety indicators | Modernization track horizon |

Retention beyond purpose is itself a doctrine defect.

---

## 8. OpenTelemetry Compatibility

Where transport requires, governance events emit as:

- OTel logs (for evidence)
- OTel metrics (for indicator surfaces — bounded, named)
- OTel spans (for governance decisions traversing multiple surfaces)

Resource attributes carry environment, release, product, and governance scope. No personal attributes are emitted.

---

## 9. Telemetry Trust Constraints

Telemetry is built to be **trusted by reviewers, not maximized for operators**. This means:

- Bounded vocabularies, not free-form labels
- Schema-validated payloads, not arbitrary maps
- Reviewer-readable types, not internal jargon
- Source-cited governance events
- No marketing extraction surfaces

---

## 10. Anti-Patterns

- Free-form `properties` blobs ("we'll figure out what to do with this later")
- Personal identifiers leaking through "convenience"
- Schema versioning skipped for speed
- Sampling rates raised toward individual resolution
- Vendor-extraction sinks ("just send everything to X")
- Retention-by-default-forever
- Telemetry as marketing instrument

---

## 11. Discipline

Governance telemetry is the wire on which institutional trust travels. Discipline at the wire is discipline at every layer above. Without it, every higher governance claim is unsubstantiated.

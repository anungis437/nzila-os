# Nzila OS Decision Layer — Governance & Safety

## Design Principles

The Decision Layer is built on five immutable governance principles:

### 1. Recommendation-First

Every output is a recommendation. The system never modifies organisational state, triggers external actions, or alters workflows without explicit human approval. This is architecturally enforced through the eight-state lifecycle — a decision must pass through PENDING_REVIEW and APPROVED before it can reach EXECUTED.

### 2. Evidence-Backed

Every decision includes typed evidence references that link to the specific platform signals that triggered it. Evidence types include anomalies, insights, metrics, policy artefacts, change records, and governance snapshots. A decision without evidence cannot be generated.

### 3. Confidence Transparency

Every decision carries a 0.0–1.0 confidence score. The score reflects signal strength, evidence density, and rule specificity. It is visible in every surface — the Control Plane, export packs, and audit trail. The system never presents a recommendation as certainty.

### 4. Policy Enforcement

The Decision Layer integrates with the Platform Policy Engine. Four policy dimensions are evaluated for every decision:

| Dimension | Rule |
|-----------|------|
| Environment protection | Decisions targeting PRODUCTION or STAGING require elevated approval |
| Severity escalation | CRITICAL decisions require senior leadership review |
| Pending approvals | Execution blocked until all required approvals are satisfied |
| Expiration | Decisions past their expiry window cannot be executed |

Policy produces an explicit `execution_allowed` flag with human-readable reasons. This is enforced, not advisory.

### 5. Full Auditability

Every decision lifecycle event is logged as an immutable audit entry:

| Event | Data Captured |
|-------|---------------|
| Generation | Full decision record, triggering rule, evidence refs |
| Viewing | Actor, timestamp |
| Approval | Actor, timestamp, approval notes |
| Rejection | Actor, timestamp, rejection reason |
| Deferral | Actor, timestamp, deferral reason |
| Execution | Actor, timestamp, execution notes |
| Expiration | Timestamp, expiry policy |
| Feedback | Actor, action type, notes |

## What the Decision Layer Does Not Do

To maintain buyer trust, the following capabilities are explicitly excluded:

| Excluded Capability | Reason |
|---------------------|--------|
| Autonomous execution | Violates recommendation-first principle |
| Free-form text generation | Structured records prevent prompt injection and hallucination |
| External API calls | Decisions do not trigger integrations without human action |
| Data modification | The engine reads signals but never writes to source systems |
| Model retraining | Rules are version-controlled code, not retrained models |
| Cross-org data sharing | Decision records are scoped to org_id |

## AI Governance Controls

### Engine Versioning

Every decision record includes `generated_by.engine_version` (currently `1.0.0`). When rules are updated, the engine version increments, providing a clear lineage from decision to the rule set that generated it.

### Schema Validation

All decision records are validated at creation time using Zod schemas. Invalid records cannot enter the system. This prevents malformed data from reaching reviewers.

### Deterministic Rules

The eight built-in rules are deterministic pattern matchers. Given identical inputs, they produce identical outputs. There is no stochastic element in the decision generation path.

### Status Transition Governance

Status transitions are strictly validated. Invalid transitions (e.g., CLOSED → GENERATED) are rejected at the API level. The transition graph is immutable.

### Environment Awareness

Decisions include environment context (LOCAL, PREVIEW, STAGING, PRODUCTION) and environment protection status. Rules and policies adjust behaviour based on environment — production decisions receive stricter governance.

## Review Workflow

```
Decision Generated
       │
       ▼
  PENDING_REVIEW ◄── reviewer opens decision in Control Plane
       │
       ├── APPROVE ──► APPROVED ──► EXECUTE ──► EXECUTED ──► CLOSED
       │
       ├── REJECT ──► REJECTED ──► CLOSED
       │
       ├── DEFER ──► DEFERRED ──► (returns to PENDING_REVIEW later)
       │
       └── (no action) ──► EXPIRED ──► CLOSED
```

Every transition records the acting operator and timestamp. Multi-stakeholder approval is supported through the `required_approvals` field — execution is blocked until all listed roles have approved.

## Export & Compliance

Decision export packs contain:

- Full decision record with all fields
- Evidence refs with source references
- Policy context (execution_allowed, reasons)
- Governance status snapshot at decision time
- Change status snapshot at decision time
- SHA-256 integrity hash covering the entire pack
- Export timestamp

Packs are designed for compliance review, audit submission, and procurement evidence.

## Incident Response

If a decision is found to be incorrect:

1. **Reject** — The decision is moved to REJECTED with a documented reason
2. **Audit** — The full audit trail is preserved, including the rejection
3. **Root cause** — The triggering rule and source signals are inspectable via evidence refs
4. **Correction** — New decisions can be generated with corrected signals
5. **Export** — The complete decision lifecycle (generation through rejection) is exportable for post-incident review

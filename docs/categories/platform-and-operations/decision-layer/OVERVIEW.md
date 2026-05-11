# Nzila OS Decision Layer — Overview

## What It Is

The **Nzila OS Decision Layer** is a cross-app operational recommendation system embedded in the Nzila OS platform. It transforms platform signals — anomalies, insights, governance state, and operational events — into **evidence-backed decision recommendations** that human operators review and act on.

It is **not** a chatbot. It is **not** an autonomous workflow engine. It is a governed, auditable, recommendation-first decision support system designed for organisations that need transparent, reviewable operational decisions.

## How It Works

```
Platform Signals ─► Decision Engine ─► Evidence-Backed Recommendations ─► Human Review ─► Action
      │                    │                         │                          │
  anomalies          8 decision rules          confidence scores          approval gates
  insights           policy filtering          evidence refs              audit trail
  signals            severity ranking          recommended actions        feedback loop
  changes            environment context       required approvals         export packs
```

1. **Signal ingestion** — The engine consumes anomalies from the Anomaly Engine, cross-app insights and operational signals from the Intelligence Layer, change records from Change Management, and governance state.

2. **Rules evaluation** — Eight domain-specific rules evaluate signals against thresholds and patterns, generating decision candidates with category, severity, and confidence scores.

3. **Evidence attachment** — Every decision is enriched with typed evidence refs that link back to the original anomalies, insights, metrics, and policy artefacts that triggered it.

4. **Policy filtering** — Decisions pass through the Policy Engine, which evaluates environment protection levels, severity escalation rules, required approvals, and expiration windows.

5. **Ranking** — A weighted multi-factor scoring system prioritises decisions by severity, confidence, evidence density, policy urgency, and recency.

6. **Human review** — Decisions surface in the Control Plane UI with clear status badges, evidence panels, and approval workflows. No decision executes without explicit human review.

7. **Audit trail** — Every decision lifecycle event is logged: generation, viewing, approval, rejection, deferral, execution, expiration, and feedback.

## Who It Is For

| Role | Use Case |
|------|----------|
| Operations leadership | Prioritised view of organisational decisions requiring attention |
| Risk / compliance officers | Evidence-backed risk escalation with audit trail |
| Finance / CFO teams | Financial anomaly review with confidence scores |
| HR / union administration | Staffing and grievance management recommendations |
| IT / platform teams | Deployment risk assessment and change review |
| Governance / audit teams | Full decision lineage from signal to outcome |
| Procurement / buyers | Verifiable governance posture for vendor evaluation |

## What Decisions It Improves

The Decision Layer covers ten categories:

| Category | Example |
|----------|---------|
| STAFFING | Grievance backlog spike triggers steward reassignment recommendation |
| RISK | Employer risk increase triggers escalation to leadership |
| FINANCIAL | Budget variance or pricing outlier triggers CFO review |
| GOVERNANCE | Governance threshold breach triggers compliance review |
| COMPLIANCE | Arbitration risk pattern triggers legal review |
| OPERATIONS | Cross-app performance degradation triggers ops coordination |
| PARTNER | Partner underperformance triggers follow-up action |
| CUSTOMER | Customer-facing anomaly triggers response recommendation |
| DEPLOYMENT | High-risk production deployment triggers approval gate |
| OTHER | Emerging patterns not yet categorised |

## How It Is Governed

Every decision is:

- **Recommendation-first** — No automatic execution. Every decision is a recommendation until a human approves it.
- **Evidence-backed** — Linked to specific anomalies, insights, metrics, and policy artefacts via typed evidence refs.
- **Confidence-scored** — A 0.0–1.0 confidence score reflects the engine's certainty, never presented as fact.
- **Review-required** — Critical and high-severity decisions require explicit approval before any action.
- **Policy-aware** — The Policy Engine can block execution in protected environments or when required approvals are missing.
- **Auditable** — Full lifecycle logging from generation through outcome, exportable as tamper-evident decision packs.
- **Version-tracked** — Engine version and model version are embedded in every decision record.

## Why It Is Safer Than Generic AI Copilots

| Generic AI Copilot | Nzila OS Decision Layer |
|--------------------|------------------------|
| Free-form text generation | Structured, schema-validated decision records |
| No evidence trail | Every decision linked to source anomalies, insights, and policies |
| No approval workflow | Eight-state lifecycle with required approvals |
| Opaque confidence | Explicit 0.0–1.0 confidence score with methodology |
| No policy enforcement | Policy engine blocks execution in protected environments |
| No audit trail | Full lifecycle audit log, exportable for compliance |
| Model version unknown | Engine and model versions embedded in every record |
| Autonomous by default | Recommendation-first by design |

## Platform Integration

The Decision Layer integrates with:

| Package | Role |
|---------|------|
| platform-anomaly-engine | Source of anomaly signals |
| platform-intelligence | Source of cross-app insights and operational signals |
| platform-change-management | Source of change records and deployment context |
| platform-policy-engine | Policy evaluation and execution gating |
| platform-governance | Governance status and compliance context |
| platform-environment | Environment protection levels |
| platform-observability | Telemetry and performance context |
| Control Plane | Human review interface and dashboard |

## Key Numbers

- **8** decision rules covering all major organisational domains
- **10** decision categories spanning operations, finance, compliance, and governance
- **8** lifecycle states with governed transitions
- **4** severity levels with weighted priority scoring
- **5** evidence ref types linking to anomalies, insights, metrics, policies, and changes
- **100%** audit coverage — every decision event is logged
- **0** autonomous actions — every decision requires human review

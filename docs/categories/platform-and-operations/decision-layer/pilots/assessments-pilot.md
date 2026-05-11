# Decision Layer Pilot — Assessment Governance

> 60-day pilot scope for deploying the Decision Layer across assessment and examination governance workflows.

---

## Pilot Overview

| Field | Value |
|-------|-------|
| Vertical | Assessment / Examinations |
| Duration | 60 days |
| Target users | 4–6 assessment officers + 2–3 regional managers + 1–2 compliance leads |
| Bundle | Assessment App + Control Plane + Decision Layer + Intelligence + Governance |
| Success criteria | See metrics below |

---

## Scope

### In Scope

- Deploy Decision Layer with assessment-relevant rules (compliance gap, risk escalation, operations alert)
- Connect to scoring, integrity, and centre compliance data feeds
- Enable Control Plane Decision Summary page for compliance and management
- Configure multi-level review: assessment officers → regional managers → compliance leads
- Generate and export at least 2 decision packs for regulatory review
- Track scoring variance and integrity anomalies through the decision lifecycle

### Out of Scope

- Integration with external regulatory reporting systems
- Custom decision rules (uses built-in 8-rule set)
- Auto-hold or auto-release of exam results (decisions are advisory)
- Multi-org or multi-jurisdiction deployment

---

## Pilot Scenarios

### Scenario 1: Scoring Variance → Statistical Review

- **Trigger:** Anomaly engine detects scoring deviation in a cohort (>2σ from regional mean)
- **Decision:** COMPLIANCE / REVIEW_REQUEST / HIGH
- **Reviewer:** Assessment officer → regional manager
- **Expected outcome:** Officer reviews statistical evidence, confirms or refutes variance, escalates if unresolved

### Scenario 2: Integrity Anomaly → Hold & Investigation

- **Trigger:** Pattern anomaly flagged (e.g., identical response sequences across candidates)
- **Decision:** RISK / ESCALATION / CRITICAL
- **Reviewer:** Compliance lead + regional manager
- **Expected outcome:** Dual review, decision to hold results pending investigation, full audit trail

### Scenario 3: Centre Compliance Gap → Remediation

- **Trigger:** Operational signal indicates a centre failing compliance thresholds
- **Decision:** OPERATIONS / RECOMMENDATION / MEDIUM
- **Reviewer:** Regional manager
- **Expected outcome:** Manager reviews centre data, approves remediation plan or defers with notes

---

## User Roles

| Role | Access | Actions |
|------|--------|---------|
| Assessment Officer | View assigned decisions, review evidence | Submit review (approve/reject/defer) |
| Regional Manager | View all regional decisions | Submit review, escalate to compliance |
| Compliance Lead | View all decisions, Decision Summary | Submit review, generate export packs |
| Platform Admin | Full access | Configure, manage users, system health |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Decisions generated | ≥ 15 in 60 days | `DecisionSummary.total` |
| Acceptance rate | ≥ 55% | `(APPROVED + EXECUTED) / total` |
| Mean time to review | < 36 hours | `reviewed_at - generated_at` |
| Critical decisions reviewed within SLA | 100% within 12h | CRITICAL decisions reviewed within 12h |
| Evidence coverage | 100% | All decisions have evidence refs |
| Integrity anomalies caught | ≥ 2 | RISK/ESCALATION decisions from integrity anomalies |
| Export packs generated | ≥ 2 | Verified governance packs exported |
| User satisfaction | ≥ 3.5/5 | Post-pilot survey |

---

## Review Workflow

```
Data anomaly / integrity signal
        ↓
  Decision generated (GENERATED)
        ↓
  Assessment officer notified (PENDING_REVIEW)
        ↓
  Reviews evidence: scoring data, integrity flags, centre compliance
        ↓
  Submits initial review (APPROVE / DEFER / REJECT)
        ↓
  If CRITICAL: escalates to compliance lead → dual review
        ↓
  Final disposition recorded → export pack available
```

---

## Timeline

| Week | Activities |
|------|-----------|
| 1–2 | Environment setup, data feeds connected, user onboarding |
| 3–4 | Live decision generation, initial reviews across 3 scenarios |
| 5–6 | First export packs, feedback collection, metrics review |
| 7–8 | Continued operation, stakeholder debrief, go/no-go for production |

---

## Value Measurement

End-of-pilot report covering:

1. Decision volume, acceptance rate, rejection rate
2. Mean time to review for CRITICAL vs HIGH vs MEDIUM
3. Integrity anomalies detected and resolved through the decision lifecycle
4. Export pack integrity verification results
5. User satisfaction and process feedback
6. Comparison: pre-pilot manual triage time vs Decision Layer review time
7. Recommendation for production deployment, rule customisation, or scope expansion

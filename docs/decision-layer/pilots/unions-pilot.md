# Decision Layer Pilot — Union Operations

> 30-day pilot scope for deploying the Decision Layer across union operations workflows.

---

## Pilot Overview

| Field | Value |
|-------|-------|
| Vertical | Union Operations |
| Duration | 30 days |
| Target users | 5–10 stewards/reps + 2–3 leadership/admin |
| Bundle | UnionEyes + Control Plane + Decision Layer + Governance + CFO |
| Success criteria | See metrics below |

---

## Scope

### In Scope

- Deploy Decision Layer with union-specific decision rules (staffing anomaly, risk escalation, financial review)
- Connect to live grievance and financial data feeds
- Enable Control Plane Decision Summary page for leadership
- Configure 2–3 steward-level reviewers for PENDING_REVIEW decisions
- Seed initial decisions from historical anomaly data
- Export 1 decision pack for governance/compliance review

### Out of Scope

- Custom decision rules beyond the 8 built-in rules
- Integration with external case management systems
- Automated workflows triggered by decisions (decisions are advisory only)
- Multi-org configuration (single-org pilot)

---

## Pilot Scenarios

### Scenario 1: Grievance Backlog → Steward Reassignment

- **Trigger:** Staffing anomaly detected — grievance_resolution_rate drops
- **Decision:** STAFFING / RECOMMENDATION / HIGH
- **Reviewer:** Regional steward lead
- **Expected outcome:** Steward reviews evidence, approves or defers based on regional context

### Scenario 2: Financial Irregularity → Escalation

- **Trigger:** Expense anomaly flagged — treasurer_audit_frequency deviates
- **Decision:** FINANCIAL / REVIEW_REQUEST / CRITICAL
- **Reviewer:** Finance officer + national leadership
- **Expected outcome:** Dual review with notes captured in audit trail

### Scenario 3: Arbitration Trend → Leadership Review

- **Trigger:** Cross-app insight correlating arbitration outcomes across branches
- **Decision:** RISK / ESCALATION / HIGH
- **Reviewer:** National leadership
- **Expected outcome:** Decision reviewed, either deferred with justification or approved for investigation

---

## User Roles

| Role | Access | Actions |
|------|--------|---------|
| Steward / Rep | View assigned decisions, review evidence | Submit review (approve/reject/defer) |
| Regional Lead | View all regional decisions, review | Submit review, escalate to leadership |
| Finance Officer | View financial decisions | Submit review for financial decisions |
| National Leadership | View all decisions, Decision Summary page | Submit review, view audit trail |
| Platform Admin | Full access | Configure, export packs, manage users |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Decisions generated | ≥ 10 in 30 days | `DecisionSummary.total` |
| Acceptance rate | ≥ 50% | `(APPROVED + EXECUTED) / total` |
| Mean time to review | < 48 hours | `reviewed_at - generated_at` |
| Evidence coverage | 100% | All decisions have `evidence_refs.length > 0` |
| Critical decisions reviewed within SLA | 100% within 24h | CRITICAL decisions reviewed within 24h |
| User satisfaction | ≥ 3.5/5 | Post-pilot survey |
| Export pack generated | ≥ 1 | Governance pack exported and verified |

---

## Review Workflow

```
Anomaly detected → Decision generated (GENERATED)
        ↓
  Reviewer notified (PENDING_REVIEW)
        ↓
  Reviewer opens Decision Detail page
        ↓
  Reviews evidence, recommended actions, policy context
        ↓
  Submits feedback: APPROVE / REJECT / DEFER
        ↓
  Audit trail recorded → Status updated
```

---

## Timeline

| Week | Activities |
|------|-----------|
| 1 | Environment setup, data connection, user onboarding |
| 2 | Live decision generation begins, initial reviews |
| 3 | Continued operation, first export pack, feedback collection |
| 4 | Metrics review, stakeholder debrief, go/no-go for production |

---

## Value Measurement

At the end of the pilot, produce a report covering:

1. Decision volume and acceptance rate
2. Mean time to review vs pre-pilot manual triage time
3. Evidence coverage percentage
4. User feedback summary
5. Governance pack export verification
6. Recommendation for full deployment, vertical expansion, or adjustments

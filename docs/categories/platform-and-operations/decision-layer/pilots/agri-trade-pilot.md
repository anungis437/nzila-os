# Decision Layer Pilot — Agri / Trade Operations

> 45-day pilot scope for deploying the Decision Layer across agricultural trade and logistics workflows.

---

## Pilot Overview

| Field | Value |
|-------|-------|
| Vertical | Agri / Trade Operations |
| Duration | 45 days |
| Target users | 3–5 trade/ops managers + 2–3 logistics/compliance leads + 1–2 finance leads |
| Bundle | Cora/Agrimo/Trade + CFO + Control Plane + Decision Layer |
| Success criteria | See metrics below |

---

## Scope

### In Scope

- Deploy Decision Layer with trade-relevant rules (financial review, partner performance, operations alert, risk escalation)
- Connect to shipment tracking, pricing, partner SLA, and commodity data feeds
- Enable Control Plane Decision Summary page for operations and finance leadership
- Configure multi-role review: trade managers → logistics leads → finance
- Generate and export at least 1 decision pack for supply chain governance
- Track pricing anomalies and partner performance through the decision lifecycle

### Out of Scope

- Integration with external commodity exchanges or shipping APIs
- Custom decision rules beyond the 8 built-in rules
- Automated shipment holds or trade halts (decisions are advisory)
- Multi-origin or multi-currency configuration beyond pilot scope

---

## Pilot Scenarios

### Scenario 1: Shipment Compliance Risk → Ops Review

- **Trigger:** Documentation gap or compliance anomaly for a scheduled shipment
- **Decision:** OPERATIONS / REVIEW_REQUEST / HIGH
- **Reviewer:** Export manager → compliance lead
- **Expected outcome:** Manager reviews documentation status, approves contingency plan or defers pending resolution

### Scenario 2: Pricing Anomaly → Financial Review

- **Trigger:** Unit cost deviation detected (>2x supplier benchmark)
- **Decision:** FINANCIAL / REVIEW_REQUEST / MEDIUM
- **Reviewer:** Trade manager → finance lead
- **Expected outcome:** Manager verifies pricing data, confirms root cause (data entry, supplier change, market shift)

### Scenario 3: Partner SLA Drop → Follow-Up Recommendation

- **Trigger:** Multiple logistics partners drop below 60% SLA compliance
- **Decision:** PARTNER / RECOMMENDATION / HIGH
- **Reviewer:** Operations lead
- **Expected outcome:** Lead reviews partner data, schedules review meetings or assesses contract alternatives

---

## User Roles

| Role | Access | Actions |
|------|--------|---------|
| Trade Manager | View trade/financial decisions | Submit review (approve/reject/defer) |
| Export Manager | View operations decisions | Submit review, manage shipment-related decisions |
| Logistics Lead | View partner/operations decisions | Submit review, escalate to operations head |
| Finance Lead | View financial decisions, Decision Summary | Submit review, generate export packs |
| Compliance Lead | View all decisions | Submit review, audit trail access |
| Platform Admin | Full access | Configure, manage users, system health |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Decisions generated | ≥ 12 in 45 days | `DecisionSummary.total` |
| Acceptance rate | ≥ 50% | `(APPROVED + EXECUTED) / total` |
| Mean time to review | < 24 hours | `reviewed_at - generated_at` |
| Critical decisions reviewed within SLA | 100% within 12h | CRITICAL reviewed within 12h |
| Evidence coverage | 100% | All decisions have evidence refs |
| Pricing anomalies caught | ≥ 3 | FINANCIAL decisions from pricing anomalies |
| Partner decisions generated | ≥ 2 | PARTNER decisions from SLA tracking |
| Export packs generated | ≥ 1 | Verified governance pack exported |
| User satisfaction | ≥ 3.5/5 | Post-pilot survey |

---

## Review Workflow

```
Anomaly / Signal from trade data
        ↓
  Decision generated (GENERATED)
        ↓
  Trade/Export manager notified (PENDING_REVIEW)
        ↓
  Reviews evidence: pricing data, shipment status, partner SLAs
        ↓
  Submits review (APPROVE / REJECT / DEFER)
        ↓
  If CRITICAL: escalates to finance/compliance → dual review
        ↓
  Final disposition recorded → export pack available
```

---

## Timeline

| Week | Activities |
|------|-----------|
| 1 | Environment setup, data feeds connected, user onboarding |
| 2–3 | Live decision generation, initial reviews across all 3 scenarios |
| 4–5 | Export pack generation, feedback collection, mid-point review |
| 6 | Final metrics review, stakeholder debrief, go/no-go assessment |

---

## Value Measurement

End-of-pilot report covering:

1. Decision volume by category (FINANCIAL, PARTNER, OPERATIONS)
2. Acceptance rate and rejection patterns
3. Mean time to review for shipment-critical vs routine decisions
4. Pricing anomalies detected and resolved through the lifecycle
5. Partner SLA decision outcomes
6. Export pack integrity verification
7. User satisfaction and process feedback
8. ROI estimate: time saved on manual trade triage vs Decision Layer-assisted
9. Recommendation for production deployment or scope adjustment

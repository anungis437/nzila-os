# Decision Layer — Value Model

> Measurable outcomes that demonstrate the Decision Layer's impact on operations, governance, and risk.

---

## Core Metrics

| Metric | Definition | How Measured | Target |
|--------|-----------|-------------|--------|
| Decisions Generated | Total recommendations produced by the engine | `DecisionSummary.total` | Growing with platform usage |
| Acceptance Rate | % of decisions approved or executed vs total | `(APPROVED + EXECUTED) / total × 100` | > 60% |
| Rejection Rate | % of decisions rejected by reviewers | `REJECTED / total × 100` | < 30% (validates signal quality) |
| Pending Review Count | Decisions awaiting human action | `DecisionSummary.pending_review` | Trending down |
| Critical Open | Critical decisions not yet resolved | `DecisionSummary.critical_open` | 0 target |
| Mean Time to Review | Average time from GENERATED to first review action | `reviewed_at - generated_at` mean | < 24 hours |
| Evidence Coverage | % of decisions with at least 1 evidence ref | Count where `evidence_refs.length > 0` | 100% |
| Approval-Gated | % of decisions requiring explicit approval | Count where `required_approvals.length > 0` | 100% for HIGH/CRITICAL |
| Policy-Restricted | Decisions where execution is policy-blocked | Count where `execution_allowed === false` | Appropriate to context |

---

## Value Proof Points

### 1. Faster Anomaly-to-Decision Cycle

**Before:** Anomalies detected by monitoring but manually triaged — average 48–72 hours to first action.

**After:** The Decision Layer generates a structured recommendation within seconds of anomaly detection. The reviewer sees the evidence, recommended actions, and policy context immediately.

**Measurable:** Compare `generated_at` timestamps against anomaly detection timestamps.

### 2. Governance Without Bottleneck

**Before:** Review boards meet weekly; critical issues wait in queue.

**After:** Each decision is individually reviewable with clear severity, evidence, and approval requirements. Critical decisions surface immediately with the review banner.

**Measurable:** `pending_review` trending down; HIGH/CRITICAL decisions reviewed within SLA.

### 3. Audit Trail as Compliance Asset

**Before:** Audit trail reconstructed manually from emails, tickets, chat logs.

**After:** Every decision has a machine-readable audit trail: who generated, who reviewed, what evidence, what outcome, when.

**Measurable:** `DecisionAuditEntry` records per decision; complete lifecycle coverage.

### 4. No Shadow Automation

**Before:** Unclear which systems are automated, which are advisory.

**After:** Every decision explicitly states `review_required`, `execution_allowed`, and `required_approvals`. The review banner confirms "no automatic action has been taken."

**Measurable:** 100% of decisions have policy context recorded.

### 5. Reduced Decision Fatigue

**Before:** Teams receive hundreds of alerts; real signals lost in noise.

**After:** The Decision Layer ranks and prioritises recommendations by severity, confidence, and policy. Reviewers see a curated queue, not raw alerts.

**Measurable:** Decision volume versus alert/anomaly volume — shows filtering ratio.

---

## Dashboard Metrics (Control Plane)

The `/decision-summary` page exposes these metrics as live cards:

| Card | Source | Interpretation |
|------|--------|---------------|
| Acceptance Rate | `(APPROVED + EXECUTED) / total` | Signal quality — high rate means the engine generates useful recommendations |
| Decisions Resolved | `APPROVED + EXECUTED + REJECTED + CLOSED` | Throughput — how many decisions have been acted on |
| Awaiting Review | `pending_review` | Queue depth — should trend toward zero |
| Human-Reviewed | `APPROVED + REJECTED + DEFERRED + EXECUTED` | Governance compliance — every decision reviewed by a person |
| Evidence-Backed | Count where `evidence_refs.length > 0` | Evidence coverage — should be 100% |
| Approval-Gated | Count where `required_approvals.length > 0` | Safety gate coverage |
| Policy-Restricted | Count where `execution_allowed === false` | Policy enforcement visibility |
| Decisions by Domain | By `category` field | Business coverage breadth |

---

## ROI Framework

### Quantitative

| Factor | Calculation |
|--------|------------|
| Time saved per decision | `(manual_triage_hours - decision_review_minutes) × hourly_rate` |
| Compliance cost avoided | `audit_preparation_hours_saved × auditor_rate` |
| Risk reduction | `critical_decisions_caught × avg_incident_cost × probability_reduction` |

### Qualitative

- Improved trust with external auditors via exportable decision packs
- Reduced organisational risk from undocumented decision-making
- Consistent governance across business units and verticals
- Clear separation of AI recommendation from human decision authority

---

## Measurement Schedule

| Period | Activity |
|--------|---------|
| Weekly | Review pending decisions count, acceptance rate |
| Monthly | Assess mean review time, evidence coverage, category distribution |
| Quarterly | ROI calculation, stakeholder report, pilot review |
| Annually | Value model recalibration, benchmark against industry |

---

## Integration with Procurement Evidence

The value metrics feed directly into procurement packs:

- `collectProcurementPack()` includes decision summary statistics
- Export packs contain full audit trails and evidence chains
- RFP responses reference measurable outcomes from the value model

This ensures every commercial claim is backed by data the customer can independently verify.

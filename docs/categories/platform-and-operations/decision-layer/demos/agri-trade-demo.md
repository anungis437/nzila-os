# Agri / Trade Operations — Demo Scenarios

## Prerequisites

Run the demo seed to populate decision records:

```bash
pnpm exec tsx scripts/decision-seed-demo.ts
```

Relevant seeded decisions for the agri/trade vertical:

| # | Decision ID | Title | Scenario |
|---|-------------|-------|----------|
| 3 | DEC-2026-0003 | Pricing outlier detected in flow | Price anomaly review |
| 4 | DEC-2026-0004 | Partner performance drop — delivery_sla_compliance | Partner follow-up |

Open the Control Plane at `http://localhost:3010`.

---

## Scenario 1: Shipment Risk → Ops Review Recommendation

### Narrative

"A shipment in the export pipeline has been flagged with a compliance risk signal. The Anomaly Engine detected a documentation gap — the phytosanitary certificate for Shipment SH-7823 has expired, and the shipment is scheduled for loading in 48 hours.

The Decision Layer generated an OPERATIONS review request with 80% confidence. The export manager needs to review and decide whether to hold the shipment, expedite documentation, or re-route."

### Decision Structure

| Field | Value |
|-------|-------|
| Category | OPERATIONS |
| Type | REVIEW_REQUEST |
| Severity | HIGH |
| Title | Shipment compliance risk — SH-7823 phytosanitary certificate expired |
| Summary | Documentation gap detected for scheduled export shipment |
| Explanation | Shipment SH-7823 (Grade A maize, 500 MT, destination: Rotterdam) has an expired phytosanitary certificate. Loading is scheduled in 48 hours. Historical data shows certificate renewal takes 3–5 business days. |
| Confidence | 0.80 |
| Evidence Refs | `anomaly`: documentation_gap ANO-TRD-001 (expired certificate); `metric`: shipment timeline comparison |
| Recommended Actions | 1. Initiate emergency phytosanitary certificate renewal; 2. Assess alternative documentation pathways; 3. Prepare contingency re-routing plan; 4. Notify buyer of potential delay |
| Required Approvals | Export manager, compliance officer |
| Review Required | Yes |
| Policy Context | Execution allowed after export manager approval |

### Key Points to Highlight

- "The decision links directly to the expired certificate anomaly — the export manager can verify this against the actual documentation status."
- "The recommended actions are ordered by priority: renew first, assess alternatives second, prepare contingency third."
- "The 80% confidence reflects the reliability of the documentation tracking signal. The export manager verifies before acting."
- "No shipment has been held or modified. The system flagged the risk; the operations team decides."

---

## Scenario 2: Pricing Anomaly → Approval Review Decision

### Narrative

"This decision is already seeded in the demo data. A pricing outlier was detected in Flow — unit costs for building materials are 130% above the supplier benchmark. The Decision Layer generated a FINANCIAL review request with 65% confidence.

Notably, this decision has already been reviewed and approved by the procurement lead, who confirmed it was a data entry error."

### Pages to Open

1. **`/decisions`** — Decision list page
   - Locate "Pricing outlier detected in flow"
   - Point out: severity badge (MEDIUM, yellow), status badge (APPROVED, green), confidence (65%)

2. **`/decisions/DEC-2026-0003`** — Decision detail page
   - **Summary:** "Pricing for unit_cost deviated 2.3x from expected range"
   - **Evidence:** `anomaly` → ANO-003: "pricing_outlier: 2.3x deviation on unit_cost"
   - **Recommended Actions:** Review pricing model, validate supplier rates, compare historical data
   - **Review History:** Show the review by `procurement-lead` with notes: "Confirmed as data entry error — supplier rates updated."
   - **Policy Context:** Execution allowed = Yes
   - **Status:** APPROVED (was reviewed and acted on)

### Key Points to Highlight

- "This is an end-to-end demonstration: the system detected an anomaly, generated a recommendation, a human reviewed it, confirmed the root cause, and resolved it."
- "The review notes show the procurement lead's finding — it was a data entry error, not a supplier issue. The system did not assume the cause."
- "The confidence score of 65% is moderate — this correctly reflects that a 2.3x deviation could have multiple explanations."
- "The full lifecycle is in the audit trail: generated → reviewed → approved."

---

## Scenario 3: Partner Underperformance → Follow-Up Decision

### Narrative

"Three logistics partners have dropped below 60% SLA compliance this month. The Decision Layer generated a PARTNER recommendation with 81% confidence. The evidence includes both the performance anomaly and a cross-app insight showing a trend across partners."

### Pages to Open

1. **`/decisions`** — Locate "Partner performance drop — delivery_sla_compliance"
   - Severity: HIGH (amber), Status: PENDING_REVIEW (yellow), Confidence: 81%

2. **`/decisions/DEC-2026-0004`** — Decision detail page
   - **Evidence:** 2 refs:
     - `anomaly` → ANO-004: "partner_performance_drop: 2.8x deviation on delivery_sla_compliance"
     - `insight` → INS-001: "compliance: SLA compliance declining across logistics partners"
   - **Recommended Actions:**
     1. Schedule partner review meetings
     2. Assess contract SLAs
     3. Consider backup logistics providers
   - **Review Required:** Yes badge
   - **Metadata:** Category = PARTNER, Type = RECOMMENDATION

### Key Points to Highlight

- "Two types of evidence support this decision: a direct performance anomaly and a cross-app intelligence insight that correlates the trend across partners."
- "The recommended actions escalate appropriately: review first, assess SLAs second, consider alternatives third."
- "The system does not recommend terminating partners. It recommends review. The operations leader decides the appropriate follow-up."
- "The 81% confidence reflects both the strength of the performance drop signal and the corroborating cross-app insight."

---

## Demo Flow Summary

| Step | Duration | Page | Action |
|------|----------|------|--------|
| 1 | 1 min | `/decisions` | Show summary cards with pending and critical counts |
| 2 | 2 min | Discussion | Explain shipment risk scenario and evidence trail |
| 3 | 3 min | `/decisions/DEC-2026-0003` | Walk through resolved pricing anomaly decision |
| 4 | 3 min | `/decisions/DEC-2026-0004` | Show partner performance decision with dual evidence |
| 5 | 1 min | `/decisions` | Recap: evidence-backed, human-reviewed, lifecycle-tracked |

**Total: ~10 minutes**
